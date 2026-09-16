/**
 * maintenance.service.ts — l'état de maintenance planifié (C-PR8c, D64 1A)
 * ======================================================================
 * UN document `PlatformSettings` (clé `maintenance`, `values` = { enabled, messageFr, messageEn,
 * scheduledAt }, verrou `version`). Écrit par OPS ou SUPER_ADMIN avec motif, journalisé
 * (`MAINTENANCE_CHANGED`, avant / après), annoncé aux SUPER_ADMIN. Le gateway le relit toutes les
 * 10 s ; les bandeaux lisent `GET /api/maintenance`. `db` injecté (structurel).
 */
import { recordAdminAction } from "@packages/admin-audit";
import { ConflictError, ValidationError } from "@packages/error-handler";
import { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";
import type { MaintenanceState, UpdateMaintenanceRequest } from "@packages/api-contracts";

export const MAINTENANCE_KEY = "maintenance";
export type MaintenanceValues = { enabled: boolean; messageFr: string; messageEn: string; scheduledAt: string | null };
export const DEFAULT_MAINTENANCE: MaintenanceValues = { enabled: false, messageFr: "", messageEn: "", scheduledAt: null };

type Row = { values: unknown; version: number; updatedAt: Date; updatedByAdminId: string | null };
export type MaintenanceDb = {
  platformSettings: {
    findUnique(args: { where: { key: string } }): Promise<Row | null>;
    create(args: { data: { key: string; values: unknown; version: number; updatedByAdminId: string } }): Promise<unknown>;
    updateMany(args: { where: { key: string; version: number }; data: { values: unknown; version: number; updatedByAdminId: string } }): Promise<{ count: number }>;
  };
  adminAction: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  user: { findUnique(args: { where: { id: string }; select: Record<string, boolean> }): Promise<{ firstName: string; lastName: string } | null> };
  $transaction<T>(fn: (tx: MaintenanceDb) => Promise<T>): Promise<T>;
};

/** Pur : ce qui est stocké → un état propre (valeurs manquantes = défauts). */
export function parseMaintenanceValues(raw: unknown): MaintenanceValues {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    messageFr: typeof v.messageFr === "string" ? v.messageFr : "",
    messageEn: typeof v.messageEn === "string" ? v.messageEn : "",
    scheduledAt: typeof v.scheduledAt === "string" && !Number.isNaN(Date.parse(v.scheduledAt)) ? v.scheduledAt : null,
  };
}

/**
 * A181 (recette 02-ADMIN § 5.23) — la transition, pas seulement l'état d'arrivée. L'email choisissait son sujet sur les
 * valeurs finales : lever une maintenance annoncée (date encore renseignée) partait « Maintenance planifiée ».
 */
export type MaintenanceChangeKind = "ENABLED" | "LIFTED" | "SCHEDULED" | "UNSCHEDULED" | "UPDATED";
export function maintenanceChangeKind(before: MaintenanceValues, after: MaintenanceValues): MaintenanceChangeKind {
  if (!before.enabled && after.enabled) return "ENABLED";
  if (before.enabled && !after.enabled) return "LIFTED";
  if (!after.enabled && after.scheduledAt && after.scheduledAt !== before.scheduledAt) return "SCHEDULED";
  if (!after.enabled && !after.scheduledAt && before.scheduledAt) return "UNSCHEDULED";
  return "UPDATED";
}

/**
 * A181 — ce qui est réellement écrit. Lever clôt l'annonce qui l'a précédée (sinon le bandeau ambre revenait sur les deux
 * fronts, ANO-ADM-63) ; une NOUVELLE date d'annonce hors lecture seule doit être à venir (ANO-ADM-67).
 */
export function resolveMaintenanceWrite(before: MaintenanceValues, body: Pick<UpdateMaintenanceRequest, "enabled" | "messageFr" | "messageEn" | "scheduledAt">, now: Date = new Date()): MaintenanceValues {
  const after: MaintenanceValues = { enabled: body.enabled, messageFr: body.messageFr ?? "", messageEn: body.messageEn ?? "", scheduledAt: body.scheduledAt ?? null };
  if (before.enabled && !after.enabled) return { ...after, scheduledAt: null };
  if (!after.enabled && after.scheduledAt && after.scheduledAt !== before.scheduledAt && Date.parse(after.scheduledAt) <= now.getTime()) {
    throw new ValidationError("The announced date is already past.", { code: "MAINTENANCE_SCHEDULE_IN_PAST" });
  }
  return after;
}

const stale = () => new ConflictError("The maintenance state changed meanwhile: reload and try again.", { code: "STALE_VERSION" });
/** Création concurrente du document (clé unique) : l'autre écriture a gagné. */
const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export function makeMaintenanceService(deps: {
  db: MaintenanceDb;
  notify?: (n: { actorId: string; before: MaintenanceValues; after: MaintenanceValues; reason: string; kind: MaintenanceChangeKind }) => Promise<void>;
  /** A182 — le gateway est-il forcé par `MAINTENANCE_MODE` ? (lu dans sa santé ; repli : l'environnement local). */
  forcedByEnvironment?: () => Promise<boolean>;
  now?: () => Date;
}) {
  const forced = deps.forcedByEnvironment ?? (async () => process.env.MAINTENANCE_MODE === "on");
  async function current(db: MaintenanceDb) {
    const row = await db.platformSettings.findUnique({ where: { key: MAINTENANCE_KEY } });
    return row ? { values: parseMaintenanceValues(row.values), version: row.version, row } : { values: { ...DEFAULT_MAINTENANCE }, version: 0, row: null };
  }
  return {
    /** `envOverride` : passé par l'appelant qui a déjà sondé le gateway (page d'état), sinon sondé ici. */
    async read(opts: { envOverride?: boolean } = {}): Promise<MaintenanceState> {
      const [cur, envOverride] = await Promise.all([current(deps.db), opts.envOverride ?? forced()]);
      const by = cur.row?.updatedByAdminId ? await deps.db.user.findUnique({ where: { id: cur.row.updatedByAdminId }, select: { firstName: true, lastName: true } }) : null;
      return { ...cur.values, updatedAt: cur.row?.updatedAt.toISOString() ?? null, updatedBy: by ? `${by.firstName} ${by.lastName.charAt(0)}.` : null, version: cur.version, envOverride };
    },
    async update(actor: { id: string; ip?: string | null; userAgent?: string | null }, body: UpdateMaintenanceRequest): Promise<MaintenanceState> {
      // A182 — l'environnement du gateway l'emporte : écrire la base « pour après » enverrait un email « levée » mensongère.
      if (await forced()) throw new ConflictError("Maintenance is forced by the gateway environment (MAINTENANCE_MODE): remove the variable and restart the gateway.", { code: "MAINTENANCE_FORCED_BY_ENVIRONMENT" });
      const now = deps.now?.() ?? new Date();
      let written: { before: MaintenanceValues; after: MaintenanceValues };
      try {
        // ANO-ADM-65 (recette § 5.23) — trois enregistrements simultanés : [200, 500, 500]. Conflit d'écriture rejoué ; au
        // réessai, le verrou de version répond 409 ; deux créations du document → la clé unique tranche, 409 aussi.
        written = await withWriteConflictRetry(() => deps.db.$transaction(async (tx) => {
          const cur = await current(tx);
          if (cur.version !== body.expectedVersion) throw stale();
          const after = resolveMaintenanceWrite(cur.values, body, now);
          const version = cur.version + 1;
          if (cur.row) {
            const r = await tx.platformSettings.updateMany({ where: { key: MAINTENANCE_KEY, version: cur.version }, data: { values: after, version, updatedByAdminId: actor.id } });
            if (r.count !== 1) throw stale();
          } else {
            await tx.platformSettings.create({ data: { key: MAINTENANCE_KEY, values: after, version, updatedByAdminId: actor.id } });
          }
          await recordAdminAction(tx, { adminUserId: actor.id, action: "MAINTENANCE_CHANGED", targetType: "SETTINGS", targetId: MAINTENANCE_KEY, before: { ...cur.values, version: cur.version }, after: { ...after, reason: body.reason.trim(), version }, ip: actor.ip ?? null, userAgent: actor.userAgent ?? null });
          return { before: cur.values, after };
        }));
      } catch (e) {
        if (isUniqueViolation(e)) throw stale();
        throw e;
      }
      const { before, after } = written;
      await deps.notify?.({ actorId: actor.id, before, after, reason: body.reason.trim(), kind: maintenanceChangeKind(before, after) }).catch(() => undefined);
      return this.read({ envOverride: false });
    },
  };
}
export type MaintenanceService = ReturnType<typeof makeMaintenanceService>;
