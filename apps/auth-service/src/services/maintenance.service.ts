/**
 * maintenance.service.ts — l'état de maintenance planifié (C-PR8c, D64 1A)
 * ======================================================================
 * UN document `PlatformSettings` (clé `maintenance`, `values` = { enabled, messageFr, messageEn,
 * scheduledAt }, verrou `version`). Écrit par OPS ou SUPER_ADMIN avec motif, journalisé
 * (`MAINTENANCE_CHANGED`, avant / après), annoncé aux SUPER_ADMIN. Le gateway le relit toutes les
 * 10 s ; les bandeaux lisent `GET /api/maintenance`. `db` injecté (structurel).
 */
import { recordAdminAction } from "@packages/admin-audit";
import { ConflictError } from "@packages/error-handler";
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

export function makeMaintenanceService(deps: { db: MaintenanceDb; notify?: (n: { actorId: string; before: MaintenanceValues; after: MaintenanceValues; reason: string }) => Promise<void> }) {
  async function current(db: MaintenanceDb) {
    const row = await db.platformSettings.findUnique({ where: { key: MAINTENANCE_KEY } });
    return row ? { values: parseMaintenanceValues(row.values), version: row.version, row } : { values: { ...DEFAULT_MAINTENANCE }, version: 0, row: null };
  }
  return {
    async read(): Promise<MaintenanceState> {
      const cur = await current(deps.db);
      const by = cur.row?.updatedByAdminId ? await deps.db.user.findUnique({ where: { id: cur.row.updatedByAdminId }, select: { firstName: true, lastName: true } }) : null;
      return { ...cur.values, updatedAt: cur.row?.updatedAt.toISOString() ?? null, updatedBy: by ? `${by.firstName} ${by.lastName.charAt(0)}.` : null, version: cur.version, envOverride: process.env.MAINTENANCE_MODE === "on" };
    },
    async update(actor: { id: string; ip?: string | null; userAgent?: string | null }, body: UpdateMaintenanceRequest): Promise<MaintenanceState> {
      const after: MaintenanceValues = { enabled: body.enabled, messageFr: body.messageFr ?? "", messageEn: body.messageEn ?? "", scheduledAt: body.scheduledAt ?? null };
      const before = await deps.db.$transaction(async (tx) => {
        const cur = await current(tx);
        if (cur.version !== body.expectedVersion) throw new ConflictError("The maintenance state changed meanwhile: reload and try again.");
        const version = cur.version + 1;
        if (cur.row) {
          const r = await tx.platformSettings.updateMany({ where: { key: MAINTENANCE_KEY, version: cur.version }, data: { values: after, version, updatedByAdminId: actor.id } });
          if (r.count !== 1) throw new ConflictError("The maintenance state changed meanwhile: reload and try again.");
        } else {
          await tx.platformSettings.create({ data: { key: MAINTENANCE_KEY, values: after, version, updatedByAdminId: actor.id } });
        }
        await recordAdminAction(tx, { adminUserId: actor.id, action: "MAINTENANCE_CHANGED", targetType: "SETTINGS", targetId: MAINTENANCE_KEY, before: { ...cur.values, version: cur.version }, after: { ...after, reason: body.reason.trim(), version }, ip: actor.ip ?? null, userAgent: actor.userAgent ?? null });
        return cur.values;
      });
      await deps.notify?.({ actorId: actor.id, before, after, reason: body.reason.trim() }).catch(() => undefined);
      return this.read();
    },
  };
}
export type MaintenanceService = ReturnType<typeof makeMaintenanceService>;
