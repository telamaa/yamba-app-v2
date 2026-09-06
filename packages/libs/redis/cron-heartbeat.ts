/**
 * cron-heartbeat.ts — chaque cron laisse un battement (C-PR8c, D64 4A)
 * ====================================================================
 * `yamba:cron:<service>:<nom>` → JSON { ranAt, durationMs, ok, summary, error, schedule }, TTL 7 jours.
 * Best effort : un Redis absent ne fait jamais échouer un cron. La page d'état lit tout par SCAN.
 * Pur : le client Redis est injecté (un Map suffit en test).
 *
 * D70 3A — battement EXTERNE : si `CRON_HEARTBEAT_PING_URLS` (JSON `{ "<service>:<cron>": "<url>" }`)
 * déclare une URL pour ce cron, un GET best-effort (3 s) part après chaque tick réussi ; le moniteur
 * externe alerte quand le battement manque. Un cron mort ne lève aucune erreur : c'est le seul moyen de le voir.
 */
export const CRON_HEARTBEAT_PREFIX = "yamba:cron";
export const CRON_HEARTBEAT_TTL_SECONDS = 7 * 86_400;

export type CronRun = { service: string; name: string; ranAt: string; durationMs: number; ok: boolean; summary: string | null; error: string | null; schedule: string | null };
export type HeartbeatStore = { set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>; scan(cursor: string, match: "MATCH", pattern: string, count: "COUNT", n: number): Promise<[string, string[]]>; mget(...keys: string[]): Promise<(string | null)[]> };

export const cronKey = (service: string, name: string) => `${CRON_HEARTBEAT_PREFIX}:${service}:${name}`;

export const HEARTBEAT_PING_TIMEOUT_MS = 3_000;
/** Règle pure : l'URL de battement d'un cron dans la carte `{ "<service>:<cron>": url }` (JSON invalide → aucune). */
export function resolveHeartbeatPingUrl(raw: string | undefined, service: string, name: string): string | null {
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, unknown>;
    const url = map && typeof map === "object" ? map[`${service}:${name}`] : null;
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}
/** GET best effort vers le moniteur externe — jamais d'exception, jamais d'attente au-delà de 3 s. */
export async function pingExternalHeartbeat(service: string, name: string, fetchImpl: typeof fetch = fetch, raw: string | undefined = process.env.CRON_HEARTBEAT_PING_URLS): Promise<boolean> {
  const url = resolveHeartbeatPingUrl(raw, service, name);
  if (!url) return false;
  try {
    const r = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(HEARTBEAT_PING_TIMEOUT_MS) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function recordCronRun(store: HeartbeatStore, run: Omit<CronRun, "ranAt"> & { ranAt?: Date }): Promise<void> {
  try {
    const value: CronRun = { ...run, ranAt: (run.ranAt ?? new Date()).toISOString() };
    await store.set(cronKey(run.service, run.name), JSON.stringify(value), "EX", CRON_HEARTBEAT_TTL_SECONDS);
  } catch {
    // jamais une exception depuis un cron pour un battement
  }
}

/** Exécute un tick de cron en laissant un battement (ok / erreur, durée, résumé). L'erreur est relancée à l'appelant. */
export async function withHeartbeat<T>(store: HeartbeatStore, meta: { service: string; name: string; schedule?: string | null }, fn: () => Promise<T>, summarize?: (r: T) => string): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    await recordCronRun(store, { ...meta, schedule: meta.schedule ?? null, durationMs: Date.now() - t0, ok: true, summary: summarize ? summarize(r) : null, error: null });
    void pingExternalHeartbeat(meta.service, meta.name); // D70 3A — best effort, sans attendre
    return r;
  } catch (err) {
    await recordCronRun(store, { ...meta, schedule: meta.schedule ?? null, durationMs: Date.now() - t0, ok: false, summary: null, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function listCronRuns(store: HeartbeatStore): Promise<CronRun[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await store.scan(cursor, "MATCH", `${CRON_HEARTBEAT_PREFIX}:*`, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  if (keys.length === 0) return [];
  const values = await store.mget(...keys);
  const out: CronRun[] = [];
  for (const v of values) {
    if (!v) continue;
    try { out.push(JSON.parse(v) as CronRun); } catch { /* valeur corrompue : ignorée */ }
  }
  return out.sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));
}
