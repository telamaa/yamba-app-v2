/** platform-settings.service.spec.ts — écriture des paramètres (C-PR8a, D62 5A) : bornes, portée, cohérence, verrou, journal, email. */
import { SETTINGS_DEFAULTS } from "@packages/api-contracts";
import { makePlatformSettingsService, type SettingsWriterDb } from "./platform-settings.service";

type Row = { key: string; values: Record<string, number>; version: number; updatedAt: Date; updatedByAdminId: string | null };

function fakeDb(initial?: Row) {
  let row: Row | null = initial ?? null;
  const actions: Array<Record<string, unknown>> = [];
  const db: SettingsWriterDb & { row: () => Row | null; actions: typeof actions } = {
    row: () => row,
    actions,
    platformSettings: {
      async findUnique() { return row; },
      async create({ data }) { row = { ...data, values: data.values as Record<string, number>, updatedAt: new Date(), updatedByAdminId: data.updatedByAdminId }; return row; },
      async updateMany({ where, data }) {
        if (!row || row.version !== where.version) return { count: 0 };
        row = { ...row, values: data.values as Record<string, number>, version: data.version, updatedByAdminId: data.updatedByAdminId, updatedAt: new Date() };
        return { count: 1 };
      },
    },
    adminAction: {
      async create({ data }) { actions.push(data); return data; },
      async findMany() { return actions.slice().reverse().map((a) => ({ adminUserId: a.adminUserId as string, createdAt: new Date(), after: a.after })); },
    },
    user: {
      async findUnique({ where }) { return { id: where.id, firstName: "Ada", lastName: "Lovelace" }; },
      async findMany() { return [{ id: "sa1", email: "sa1@yamba.dev", firstName: "Ada", lastName: "L", preferredLocale: "fr" }, { id: "sa2", email: "sa2@yamba.dev", firstName: "Bob", lastName: "M", preferredLocale: "en" }]; },
    },
    async $transaction(fn) { return fn(db); },
  };
  return db;
}

const SUPER = { id: "sa1", roles: ["SUPER_ADMIN"] as const };
const OPS = { id: "ops1", roles: ["OPS"] as const };
const FINANCE = { id: "fin1", roles: ["FINANCE"] as const };
const reason = "Ajustement de la commission après étude du corridor Paris-Dakar";

describe("platform-settings.service — update", () => {
  it("écrit le document (version 1), une ligne de journal PAR clé, et notifie les SUPER_ADMIN", async () => {
    const db = fakeDb();
    const notify = jest.fn().mockResolvedValue(undefined);
    const invalidate = jest.fn();
    const svc = makePlatformSettingsService({ db, notify, invalidate });
    const r = await svc.update(SUPER, { changes: { "pricing.commissionPct": 15, "alerts.outboxLagMinutes": 30 }, reason, expectedVersion: 0 });
    expect(r).toEqual({ version: 1, changed: [{ key: "pricing.commissionPct", before: 12, after: 15 }, { key: "alerts.outboxLagMinutes", before: 15, after: 30 }] });
    expect(db.row()?.values["pricing.commissionPct"]).toBe(15);
    expect(db.row()?.values["pricing.minTransportCents"]).toBe(800); // les autres clés gardent leur défaut
    expect(db.actions.map((a) => [a.action, a.targetType, a.targetId])).toEqual([["SETTING_CHANGED", "SETTINGS", "pricing.commissionPct"], ["SETTING_CHANGED", "SETTINGS", "alerts.outboxLagMinutes"]]);
    expect(db.actions[0].after).toEqual({ key: "pricing.commissionPct", value: 15, reason, version: 1 });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].recipients.map((u: { id: string }) => u.id)).toEqual(["sa1", "sa2"]);
  });
  it("refuse hors bornes (400 avec la clé), une clé inconnue, un motif trop court, et « rien à changer »", async () => {
    const svc = makePlatformSettingsService({ db: fakeDb() });
    await expect(svc.update(SUPER, { changes: { "pricing.commissionPct": 25 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400, details: { errors: { "pricing.commissionPct": expect.stringContaining("between 5 and 20") } } });
    await expect(svc.update(SUPER, { changes: { "pricing.nope": 1 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason: "trop court", expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.update(SUPER, { changes: { "pricing.commissionPct": 12 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("portée : OPS change l'exploitation, jamais le métier ; FINANCE ne change rien (403 avant toute écriture)", async () => {
    const db = fakeDb();
    const svc = makePlatformSettingsService({ db });
    await expect(svc.update(OPS, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.update(OPS, { changes: { "alerts.outboxLagMinutes": 30, "pricing.commissionPct": 15 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.update(FINANCE, { changes: { "alerts.outboxLagMinutes": 30 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.row()).toBeNull();
    expect(db.actions).toHaveLength(0);
    await expect(svc.update(OPS, { changes: { "alerts.outboxLagMinutes": 30 }, reason, expectedVersion: 0 })).resolves.toMatchObject({ version: 1 });
  });
  it("cohérence : S ≤ M ≤ L et intervalle ≥ délai sont refusés en 400, rien n'est écrit", async () => {
    const db = fakeDb();
    const svc = makePlatformSettingsService({ db });
    await expect(svc.update(SUPER, { changes: { "pricing.sizeCoefS": 1.5 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("S ≤ M ≤ L") });
    await expect(svc.update(SUPER, { changes: { "messaging.reminderDelayMinutes": 120 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.row()).toBeNull();
    expect(db.actions).toHaveLength(0);
  });
  it("verrou optimiste : une version périmée donne 409, la bonne passe (version 2)", async () => {
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS, "pricing.commissionPct": 14 }, version: 3, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const svc = makePlatformSettingsService({ db });
    await expect(svc.update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 3 })).resolves.toMatchObject({ version: 4, changed: [{ key: "pricing.commissionPct", before: 14, after: 15 }] });
  });
});

describe("platform-settings.service — reset et read", () => {
  it("reset global : seules les clés qui s'écartent du défaut sont écrites (SETTINGS_RESET), 400 s'il n'y a rien", async () => {
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS, "pricing.commissionPct": 14, "alerts.outboxLagMinutes": 30 }, version: 2, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const svc = makePlatformSettingsService({ db });
    const r = await svc.reset(SUPER, { reason, expectedVersion: 2 });
    expect(r.changed).toEqual([{ key: "pricing.commissionPct", before: 14, after: 12 }, { key: "alerts.outboxLagMinutes", before: 30, after: 15 }]);
    expect(db.actions.every((a) => a.action === "SETTINGS_RESET")).toBe(true);
    await expect(svc.reset(SUPER, { reason, expectedVersion: 3 })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("reset d'une clé métier par OPS : 403 ; reset d'une clé d'exploitation par OPS : ok", async () => {
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS, "pricing.commissionPct": 14, "alerts.outboxLagMinutes": 30 }, version: 2, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const svc = makePlatformSettingsService({ db });
    await expect(svc.reset(OPS, { keys: ["pricing.commissionPct"], reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.reset(OPS, { keys: ["alerts.outboxLagMinutes"], reason, expectedVersion: 2 })).resolves.toMatchObject({ version: 3 });
  });
  it("read : défauts quand rien n'est stocké (version 0), puis valeurs, auteur, dernière modification groupée par version", async () => {
    const db = fakeDb();
    const svc = makePlatformSettingsService({ db });
    const empty = await svc.read();
    expect(empty.version).toBe(0);
    expect(empty.values).toEqual(SETTINGS_DEFAULTS);
    expect(empty.lastChange).toBeNull();
    expect(empty.catalog.length).toBeGreaterThan(30);
    expect(empty.fixed.length).toBeGreaterThan(5);
    await svc.update(SUPER, { changes: { "pricing.commissionPct": 15, "pricing.commissionFloorCents": 400 }, reason, expectedVersion: 0 });
    const after = await svc.read();
    expect(after.version).toBe(1);
    expect(after.values["pricing.commissionPct"]).toBe(15);
    expect(after.updatedBy).toEqual({ id: "sa1", firstName: "Ada", lastName: "Lovelace" });
    expect(after.lastChange).toMatchObject({ byName: "Ada L.", keys: expect.arrayContaining(["pricing.commissionPct", "pricing.commissionFloorCents"]) });
  });
});
