/**
 * platform-settings.service.ts — l'écriture des paramètres de la plateforme (C-PR8a, D62 5A)
 * ==========================================================================================
 * Un document, un verrou optimiste (`version`), une ligne de journal PAR clé dans la même
 * transaction (D54 8A), un email à tous les SUPER_ADMIN après le commit. Les bornes et les
 * règles de cohérence du catalogue sont refusées ici quel que soit le rôle (D4) ; la portée
 * (métier = SUPER_ADMIN seul, exploitation = OPS ou SUPER_ADMIN) se vérifie clé par clé,
 * parce qu'une même requête peut mélanger les deux.
 *
 * Testable sans base : `db` est injecté (transaction = callback recevant le même objet).
 */
import {
  FIXED_PARAMETERS,
  PLANNED_PARAMETERS,
  SETTINGS_CATALOG,
  SETTINGS_DEFAULTS,
  SETTINGS_REASON_MIN_LENGTH,
  isSettingKey,
  mergeSettingsValues,
  settingDefinition,
  settingsCoherenceIssues,
  adminRolesAllow,
  type AdminRole,
  type AdminSettingsResponse,
  type PlatformSettingsValues,
  type ResetSettingsRequest,
  type SettingKey,
  type SettingsWriteResponse,
  type UpdateSettingsRequest,
} from "@packages/api-contracts";
import { ConflictError, ForbiddenError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import { PLATFORM_SETTINGS_KEY } from "@packages/libs/settings";

type SettingsRow = { values: unknown; version: number; updatedAt: Date; updatedByAdminId: string | null };
type AuditRow = { adminUserId: string; createdAt: Date; after: unknown };
type AdminUserRow = { id: string; email: string; firstName: string; lastName: string; preferredLocale: string | null };

/** Ce que le service attend de Prisma (structurel : un Map suffit en test). */
export type SettingsWriterDb = {
  platformSettings: {
    findUnique(args: { where: { key: string } }): Promise<SettingsRow | null>;
    create(args: { data: { key: string; values: unknown; version: number; updatedByAdminId: string } }): Promise<unknown>;
    updateMany(args: { where: { key: string; version: number }; data: { values: unknown; version: number; updatedByAdminId: string } }): Promise<{ count: number }>;
  };
  adminAction: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany(args: { where: Record<string, unknown>; orderBy: { createdAt: "desc" }; take: number }): Promise<AuditRow[]>;
  };
  user: {
    findUnique(args: { where: { id: string }; select: Record<string, boolean> }): Promise<{ id: string; firstName: string; lastName: string } | null>;
    findMany(args: { where: Record<string, unknown>; select: Record<string, boolean> }): Promise<AdminUserRow[]>;
  };
  $transaction<T>(fn: (tx: SettingsWriterDb) => Promise<T>): Promise<T>;
};

export type SettingsActor = { id: string; roles: readonly AdminRole[]; ip?: string | null; userAgent?: string | null };
export type SettingsChange = { key: SettingKey; before: number; after: number };
export type SettingsNotification = { actorId: string; reset: boolean; reason: string; changes: SettingsChange[]; recipients: AdminUserRow[]; at: Date };

const LAST_CHANGE_WINDOW_MS = 7 * 86_400_000;

export function makePlatformSettingsService(deps: {
  db: SettingsWriterDb;
  clock?: () => Date;
  /** Après le commit : email aux SUPER_ADMIN (best effort — un email qui échoue n'annule pas un paramètre). */
  notify?: (n: SettingsNotification) => Promise<void>;
  /** Invalide le cache du lecteur local (le même processus lit ce qu'il vient d'écrire). */
  invalidate?: () => void;
}) {
  const clock = deps.clock ?? (() => new Date());

  async function current(db: SettingsWriterDb): Promise<{ values: PlatformSettingsValues; version: number; stored: boolean; row: SettingsRow | null }> {
    const row = await db.platformSettings.findUnique({ where: { key: PLATFORM_SETTINGS_KEY } });
    return row
      ? { values: mergeSettingsValues(row.values as Record<string, unknown>), version: row.version, stored: true, row }
      : { values: { ...SETTINGS_DEFAULTS }, version: 0, stored: false, row: null };
  }

  /** Bornes du catalogue, clé par clé — indépendant du rôle. */
  function validateValues(changes: Record<string, number>): { errors: Record<string, string>; keys: SettingKey[] } {
    const errors: Record<string, string> = {};
    const keys: SettingKey[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (!isSettingKey(key)) {
        errors[key] = "Unknown setting.";
        continue;
      }
      const def = settingDefinition(key)!;
      if (typeof value !== "number" || !Number.isFinite(value)) errors[key] = "A number is required.";
      else if (value < def.min || value > def.max) errors[key] = `Must be between ${def.min} and ${def.max} (${def.unit}).`;
      else keys.push(key);
    }
    return { errors, keys };
  }

  /** Portée par clé : métier → SUPER_ADMIN seul ; exploitation → OPS ou SUPER_ADMIN. */
  function assertScopes(actor: SettingsActor, keys: readonly SettingKey[]): void {
    const denied = keys.filter((key) => {
      const scope = settingDefinition(key)!.scope;
      return !adminRolesAllow(actor.roles, scope === "BUSINESS" ? "settings.business.write" : "settings.operations.write");
    });
    if (denied.length) throw new ForbiddenError(`Your admin profile cannot change: ${denied.join(", ")}.`);
  }

  async function commit(actor: SettingsActor, expectedVersion: number, changes: SettingsChange[], reason: string, action: "SETTING_CHANGED" | "SETTINGS_RESET"): Promise<SettingsWriteResponse> {
    const now = clock();
    const nextVersion = await deps.db.$transaction(async (tx) => {
      const cur = await current(tx);
      if (cur.version !== expectedVersion) throw new ConflictError("The settings changed meanwhile: reload and try again.");
      const nextValues: PlatformSettingsValues = { ...cur.values };
      for (const c of changes) nextValues[c.key] = c.after;
      const issues = settingsCoherenceIssues(nextValues);
      if (issues.length) throw new ValidationError(issues.join(" "), { errors: { coherence: issues.join(" ") } });
      const version = cur.version + 1;
      if (cur.stored) {
        const r = await tx.platformSettings.updateMany({ where: { key: PLATFORM_SETTINGS_KEY, version: cur.version }, data: { values: nextValues, version, updatedByAdminId: actor.id } });
        if (r.count !== 1) throw new ConflictError("The settings changed meanwhile: reload and try again.");
      } else {
        await tx.platformSettings.create({ data: { key: PLATFORM_SETTINGS_KEY, values: nextValues, version, updatedByAdminId: actor.id } });
      }
      // Une ligne PAR clé : l'historique d'un paramètre est une requête sur targetId (D62 5A).
      for (const c of changes) {
        await recordAdminAction(tx, {
          adminUserId: actor.id,
          action,
          targetType: "SETTINGS",
          targetId: c.key,
          before: { key: c.key, value: c.before, version: cur.version },
          after: { key: c.key, value: c.after, reason, version },
          ip: actor.ip ?? null,
          userAgent: actor.userAgent ?? null,
        });
      }
      return version;
    });
    deps.invalidate?.();
    if (deps.notify) {
      const recipients = await deps.db.user.findMany({
        where: { roles: { has: "ADMIN" }, adminRoles: { has: "SUPER_ADMIN" }, isDeleted: false },
        select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true },
      });
      await deps.notify({ actorId: actor.id, reset: action === "SETTINGS_RESET", reason, changes, recipients, at: now }).catch(() => undefined);
    }
    return { version: nextVersion, changed: changes };
  }

  return {
    /** Lecture fraîche (sans cache) : valeurs, défauts, version, auteur, dernière modification, catalogue, classes B et C. */
    async read(): Promise<AdminSettingsResponse> {
      const cur = await current(deps.db);
      const updatedBy = cur.row?.updatedByAdminId
        ? await deps.db.user.findUnique({ where: { id: cur.row.updatedByAdminId }, select: { id: true, firstName: true, lastName: true } })
        : null;
      const recent = await deps.db.adminAction.findMany({
        where: { targetType: "SETTINGS", createdAt: { gte: new Date(clock().getTime() - LAST_CHANGE_WINDOW_MS) } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      let lastChange: AdminSettingsResponse["lastChange"] = null;
      if (recent.length) {
        const latestVersion = (recent[0].after as { version?: number } | null)?.version ?? null;
        const batch = recent.filter((r) => ((r.after as { version?: number } | null)?.version ?? null) === latestVersion);
        const by = await deps.db.user.findUnique({ where: { id: recent[0].adminUserId }, select: { id: true, firstName: true, lastName: true } });
        lastChange = {
          at: recent[0].createdAt.toISOString(),
          byName: by ? `${by.firstName} ${by.lastName.charAt(0)}.` : recent[0].adminUserId,
          keys: [...new Set(batch.map((r) => String((r.after as { key?: string } | null)?.key ?? "")))].filter(Boolean),
        };
      }
      return {
        values: cur.values,
        defaults: { ...SETTINGS_DEFAULTS },
        version: cur.version,
        updatedAt: cur.row?.updatedAt.toISOString() ?? null,
        updatedBy: updatedBy ? { id: updatedBy.id, firstName: updatedBy.firstName, lastName: updatedBy.lastName } : null,
        lastChange,
        catalog: SETTINGS_CATALOG.map((d) => ({ ...d, consumers: [...d.consumers] })),
        fixed: FIXED_PARAMETERS.map((f) => ({ ...f })),
        planned: PLANNED_PARAMETERS.map((p) => ({ ...p })),
      };
    },

    /** PATCH : seules les clés modifiées ; 400 hors bornes / inconnue / motif court ; 403 hors portée ; 409 version. */
    async update(actor: SettingsActor, body: UpdateSettingsRequest): Promise<SettingsWriteResponse> {
      if (body.reason.trim().length < SETTINGS_REASON_MIN_LENGTH) throw new ValidationError(`A reason of at least ${SETTINGS_REASON_MIN_LENGTH} characters is required.`);
      const { errors, keys } = validateValues(body.changes);
      if (Object.keys(errors).length) throw new ValidationError("Some values are out of bounds.", { errors });
      if (keys.length === 0) throw new ValidationError("Nothing to change.");
      assertScopes(actor, keys);
      const cur = await current(deps.db);
      const changes: SettingsChange[] = keys.map((key) => ({ key, before: cur.values[key], after: body.changes[key] })).filter((c) => c.before !== c.after);
      if (changes.length === 0) throw new ValidationError("Nothing to change: every value equals the current one.");
      return commit(actor, body.expectedVersion, changes, body.reason.trim(), "SETTING_CHANGED");
    },

    /** POST /reset : clés données (ou toutes) remises au défaut du catalogue ; 400 si rien ne s'écarte du défaut. */
    async reset(actor: SettingsActor, body: ResetSettingsRequest): Promise<SettingsWriteResponse> {
      if (body.reason.trim().length < SETTINGS_REASON_MIN_LENGTH) throw new ValidationError(`A reason of at least ${SETTINGS_REASON_MIN_LENGTH} characters is required.`);
      const wanted = body.keys && body.keys.length ? body.keys : [...SETTINGS_CATALOG.map((d) => d.key)];
      const unknown = wanted.filter((k) => !isSettingKey(k));
      if (unknown.length) throw new ValidationError("Unknown setting.", { errors: Object.fromEntries(unknown.map((k) => [k, "Unknown setting."])) });
      const keys = wanted as SettingKey[];
      const cur = await current(deps.db);
      const changes: SettingsChange[] = keys.map((key) => ({ key, before: cur.values[key], after: SETTINGS_DEFAULTS[key] })).filter((c) => c.before !== c.after);
      if (changes.length === 0) throw new ValidationError("Nothing to reset: every value already equals its default.");
      assertScopes(actor, changes.map((c) => c.key));
      return commit(actor, body.expectedVersion, changes, body.reason.trim(), "SETTINGS_RESET");
    },
  };
}
export type PlatformSettingsService = ReturnType<typeof makePlatformSettingsService>;
