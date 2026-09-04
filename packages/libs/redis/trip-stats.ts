/**
 * trip-stats.ts — compteurs de demande dans Redis (D5 / C-PR6, D59)
 * ==================================================================
 * Vues des pages de trajets (dédoublonnées par visiteur et par jour) et recherches par
 * corridor (avec le nombre sans résultat). Aucune donnée personnelle : le visiteur est
 * un identifiant opaque (id utilisateur ou empreinte hachée IP + agent). Les clés de jour
 * expirent (400 j) ; le total par trajet ne meurt qu'avec le trajet. Écrit par le
 * trip-service, lu par le trip-service (cartes, détail) et l'auth-service (corridors).
 * Les fonctions de clé sont PURES et testées ; les helpers prennent le client en paramètre
 * (testables avec un Map).
 */
import { createHash } from "node:crypto";

export const TRIP_STATS_PREFIX = "yamba:stats";
export const DAY_KEY_TTL_SECONDS = 400 * 86_400;
export const VIEW_DEDUP_TTL_SECONDS = 2 * 86_400;

/** ville normalisée : minuscules, accents retirés, espaces réduits — « Paris » et « paris » sont le même corridor. */
export function normalizeCity(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[>:|]/g, "");
}
export function corridorKey(originCity: string | null | undefined, destinationCity: string | null | undefined): string | null {
  const o = normalizeCity(originCity);
  const d = normalizeCity(destinationCity);
  return o && d ? `${o}>${d}` : null;
}
export const dayKey = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export const tripViewsKey = (tripId: string) => `${TRIP_STATS_PREFIX}:views:trip:${tripId}`;
export const viewDedupKey = (tripId: string, viewer: string, day: string) => `${TRIP_STATS_PREFIX}:views:dedup:${tripId}:${day}:${viewer}`;
export const corridorViewsKey = (corridor: string, day: string) => `${TRIP_STATS_PREFIX}:views:corridor:${corridor}:${day}`;
export const corridorSearchKey = (corridor: string, day: string) => `${TRIP_STATS_PREFIX}:search:corridor:${corridor}:${day}`;
export const corridorNoResultKey = (corridor: string, day: string) => `${TRIP_STATS_PREFIX}:search:noresult:${corridor}:${day}`;
/** Corridors ayant eu au moins une recherche (SET, pas de SCAN) — complète les corridors connus des trajets. */
export const knownCorridorsKey = () => `${TRIP_STATS_PREFIX}:search:corridors`;

/** Visiteur opaque : id utilisateur, sinon empreinte tronquée de l'IP et de l'agent (jamais stockés en clair). */
export function viewerKey(userId: string | null | undefined, ip: string | null | undefined, userAgent: string | null | undefined): string {
  if (userId) return `u:${userId}`;
  return `a:${createHash("sha256").update(`${ip ?? ""}|${userAgent ?? ""}`).digest("hex").slice(0, 16)}`;
}

/** Sous-ensemble ioredis utilisé (un Map suffit en test). */
export type StatsRedis = {
  set(key: string, value: string, mode: "EX", seconds: number, flag: "NX"): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
};

/** Une vue par visiteur et par jour ; renvoie true si elle a été comptée. */
export async function recordTripView(
  redis: StatsRedis,
  input: { tripId: string; originCity: string | null; destinationCity: string | null; viewer: string; now: Date }
): Promise<boolean> {
  const day = dayKey(input.now);
  const fresh = await redis.set(viewDedupKey(input.tripId, input.viewer, day), "1", "EX", VIEW_DEDUP_TTL_SECONDS, "NX");
  if (!fresh) return false;
  await redis.incr(tripViewsKey(input.tripId));
  const corridor = corridorKey(input.originCity, input.destinationCity);
  if (corridor) {
    const k = corridorViewsKey(corridor, day);
    await redis.incr(k);
    await redis.expire(k, DAY_KEY_TTL_SECONDS);
  }
  return true;
}

/** Une recherche origine → destination ; `hadResults` = false alimente « demande sans offre ». */
export async function recordSearch(redis: StatsRedis, input: { from: string | null | undefined; to: string | null | undefined; hadResults: boolean; now: Date }): Promise<boolean> {
  const corridor = corridorKey(input.from, input.to);
  if (!corridor) return false;
  const day = dayKey(input.now);
  const k = corridorSearchKey(corridor, day);
  await redis.incr(k);
  await redis.expire(k, DAY_KEY_TTL_SECONDS);
  await redis.sadd(knownCorridorsKey(), corridor); // les corridors demandés SANS trajet doivent apparaître dans le tableau
  if (!input.hadResults) {
    const n = corridorNoResultKey(corridor, day);
    await redis.incr(n);
    await redis.expire(n, DAY_KEY_TTL_SECONDS);
  }
  return true;
}

export async function tripViews(redis: StatsRedis, tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();
  const values = await redis.mget(...tripIds.map(tripViewsKey));
  return new Map(tripIds.map((id, i) => [id, Number(values[i] ?? 0) || 0]));
}

/** Jours couverts, du plus ancien à aujourd'hui (UTC). */
export function dayKeysBack(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

/** Vues, recherches et recherches sans résultat par corridor sur N jours (un seul MGET). */
export async function corridorStats(redis: StatsRedis, corridors: string[], now: Date, days: number): Promise<Map<string, { views: number; searches: number; noResult: number }>> {
  const out = new Map(corridors.map((c) => [c, { views: 0, searches: 0, noResult: 0 }]));
  if (corridors.length === 0) return out;
  const daysList = dayKeysBack(now, days);
  const keys: string[] = [];
  for (const c of corridors) for (const d of daysList) keys.push(corridorViewsKey(c, d), corridorSearchKey(c, d), corridorNoResultKey(c, d));
  const values = await redis.mget(...keys);
  let i = 0;
  for (const c of corridors) {
    const acc = out.get(c)!;
    for (let d = 0; d < daysList.length; d++) {
      acc.views += Number(values[i++] ?? 0) || 0;
      acc.searches += Number(values[i++] ?? 0) || 0;
      acc.noResult += Number(values[i++] ?? 0) || 0;
    }
  }
  return out;
}

export async function searchedCorridors(redis: StatsRedis): Promise<string[]> {
  return redis.smembers(knownCorridorsKey());
}
