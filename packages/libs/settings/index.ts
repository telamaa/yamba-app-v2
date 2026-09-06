/**
 * @packages/libs/settings — lecture des paramètres de la plateforme (C-PR8a, D62 4A)
 * ================================================================================
 * UN document Mongo (`PlatformSettings`, key = "current"), lu par chaque service à
 * travers un lecteur avec cache mémoire (30 s) et REPLI SÛR : document absent, base
 * injoignable, JSON illisible → les valeurs par défaut du catalogue (ou la dernière
 * lecture réussie). Une base de paramètres en panne ne bloque jamais une réservation.
 *
 * Pur et testable : la base est INJECTÉE (un objet avec `platformSettings.findUnique`),
 * l'horloge aussi. `default.ts` fournit le singleton branché sur Prisma.
 */
import { mergeSettingsValues, SETTINGS_DEFAULTS, type PlatformSettingsValues } from "@packages/api-contracts";

export const PLATFORM_SETTINGS_KEY = "current";
export const SETTINGS_CACHE_TTL_MS = 30_000;

export type PlatformSettingsRecord = { values: unknown; version: number; updatedAt: Date; updatedByAdminId: string | null };
export type SettingsDb = { platformSettings: { findUnique(args: { where: { key: string } }): Promise<PlatformSettingsRecord | null> } };

export type PlatformSettingsSnapshot = {
  values: PlatformSettingsValues;
  version: number;
  updatedAt: Date | null;
  updatedByAdminId: string | null;
  /** false quand le document n'existe pas encore (valeurs = défauts, version 0). */
  stored: boolean;
};

export const DEFAULT_SNAPSHOT: PlatformSettingsSnapshot = { values: { ...SETTINGS_DEFAULTS }, version: 0, updatedAt: null, updatedByAdminId: null, stored: false };

/** Lecture brute (sans cache) — le repli sûr est ici : jamais d'exception vers l'appelant. */
export async function loadPlatformSettings(db: SettingsDb, onError?: (err: unknown) => void): Promise<PlatformSettingsSnapshot> {
  try {
    const row = await db.platformSettings.findUnique({ where: { key: PLATFORM_SETTINGS_KEY } });
    if (!row) return DEFAULT_SNAPSHOT;
    return { values: mergeSettingsValues(row.values as Record<string, unknown>), version: row.version, updatedAt: row.updatedAt, updatedByAdminId: row.updatedByAdminId, stored: true };
  } catch (err) {
    onError?.(err);
    return DEFAULT_SNAPSHOT;
  }
}

export type SettingsReader = {
  /** Valeurs (cache 30 s). */
  get(): Promise<PlatformSettingsValues>;
  /** Valeurs + version + auteur (cache 30 s). */
  snapshot(): Promise<PlatformSettingsSnapshot>;
  /** Dernière lecture connue, synchrone (défauts avant la première lecture). */
  peek(): PlatformSettingsValues;
  /** Force une relecture au prochain appel (après une écriture dans le même service). */
  invalidate(): void;
};

export function makeSettingsReader(opts: { db: SettingsDb; ttlMs?: number; clock?: () => number; onError?: (err: unknown) => void }): SettingsReader {
  const ttl = opts.ttlMs ?? SETTINGS_CACHE_TTL_MS;
  const clock = opts.clock ?? (() => Date.now());
  let cached: PlatformSettingsSnapshot | null = null;
  let fetchedAt = -Infinity;
  let inflight: Promise<PlatformSettingsSnapshot> | null = null;

  async function refresh(): Promise<PlatformSettingsSnapshot> {
    if (!inflight) {
      inflight = (async () => {
        try {
          const row = await opts.db.platformSettings.findUnique({ where: { key: PLATFORM_SETTINGS_KEY } });
          cached = row
            ? { values: mergeSettingsValues(row.values as Record<string, unknown>), version: row.version, updatedAt: row.updatedAt, updatedByAdminId: row.updatedByAdminId, stored: true }
            : DEFAULT_SNAPSHOT;
        } catch (err) {
          opts.onError?.(err);
          // Repli : dernière lecture connue, sinon les défauts — et on réessaie au prochain TTL.
          cached = cached ?? DEFAULT_SNAPSHOT;
        } finally {
          fetchedAt = clock();
          inflight = null;
        }
        return cached as PlatformSettingsSnapshot;
      })();
    }
    return inflight;
  }

  return {
    async snapshot() {
      if (cached && clock() - fetchedAt < ttl) return cached;
      return refresh();
    },
    async get() {
      return (await this.snapshot()).values;
    },
    peek() {
      return cached?.values ?? SETTINGS_DEFAULTS;
    },
    invalidate() {
      fetchedAt = -Infinity;
    },
  };
}
