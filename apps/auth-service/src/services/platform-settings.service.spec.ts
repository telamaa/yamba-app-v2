/** platform-settings.service.spec.ts — écriture des paramètres (C-PR8a, D62 5A) : bornes, portée, cohérence, verrou, journal, email. */
import { SETTINGS_DEFAULTS, settingsCoherenceIssues } from "@packages/api-contracts";
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
  it("ANO-ADM-11 — les destinataires excluent les comptes effacés ET les adresses en suppression (D35 4A)", async () => {
    const db = fakeDb();
    const spy = jest.spyOn(db.user, "findMany");
    const svc = makePlatformSettingsService({ db, notify: jest.fn().mockResolvedValue(undefined) });
    await svc.update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 0 });
    expect((spy.mock.calls[0][0] as { where: unknown }).where).toMatchObject({ AND: [{ isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] }] });
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
  it("A174 — la portée avant les bornes : OPS sur une clé métier HORS bornes reçoit 403 sans min/max ; une clé inconnue reste 400", async () => {
    const db = fakeDb();
    const svc = makePlatformSettingsService({ db });
    const refus = await svc.update(OPS, { changes: { "pricing.commissionPct": 99 }, reason, expectedVersion: 0 }).catch((e) => e);
    expect(refus).toMatchObject({ statusCode: 403, details: { code: "ADMIN_ROLE_CHANGE_DENIED" } });
    expect(refus.details).toEqual({ code: "ADMIN_ROLE_CHANGE_DENIED" });
    expect(refus.message).not.toMatch(/between/);
    await expect(svc.update(OPS, { changes: { "pricing.nope": 1 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400, details: { code: "SETTING_OUT_OF_BOUNDS" } });
    // Dans sa portée, les bornes parlent : OPS hors bornes sur une clé d'exploitation → 400 avec la clé.
    await expect(svc.update(OPS, { changes: { "alerts.outboxLagMinutes": 100000 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 400, details: { errors: { "alerts.outboxLagMinutes": expect.stringContaining("between") } } });
    expect(db.actions).toHaveLength(0);
  });
  it("invariant défensif plafond ≥ prime (arbitrage du 15/09) : exercé directement sur la règle pure", () => {
    expect(settingsCoherenceIssues({ ...SETTINGS_DEFAULTS })).toEqual([]);
    const issues = settingsCoherenceIssues({ ...SETTINGS_DEFAULTS, "protection.extendedPremiumCents": 5000, "protection.extendedCapCents": 4999 });
    expect(issues).toEqual(["Le plafond de la Garantie étendue doit être supérieur à sa prime."]);
    expect(settingsCoherenceIssues({ ...SETTINGS_DEFAULTS, "protection.extendedPremiumCents": 5000, "protection.extendedCapCents": 5000 })).toEqual([]);
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
  it("ANO-ADM-51 — conflit d'écriture (P2034) : rejoué ; au réessai la version a bougé → 409 STALE_VERSION, jamais 500, aucune ligne", async () => {
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS }, version: 1, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const transaction = db.$transaction.bind(db);
    let essais = 0;
    db.$transaction = (async (fn: Parameters<typeof db.$transaction>[0]) => {
      essais++;
      if (essais === 1) {
        await db.platformSettings.updateMany({ where: { key: "current", version: 1 }, data: { values: { ...SETTINGS_DEFAULTS, "alerts.outboxLagMinutes": 20 }, version: 2, updatedByAdminId: "ops1" } }); // l'autre admin a gagné
        throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });
      }
      return transaction(fn);
    }) as typeof db.$transaction;
    const notify = jest.fn().mockResolvedValue(undefined);
    await expect(makePlatformSettingsService({ db, notify }).update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 1 })).rejects.toMatchObject({ statusCode: 409, details: { code: "STALE_VERSION" } });
    expect(essais).toBe(2);
    expect(db.actions).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
  it("ANO-ADM-51 — document absent, deux créations concurrentes : la collision de clé unique (P2002) EST le verrou → 409", async () => {
    const db = fakeDb();
    db.platformSettings.create = async () => { throw Object.assign(new Error("Unique constraint failed on the constraint: `PlatformSettings_key_key`"), { code: "P2002" }); };
    await expect(makePlatformSettingsService({ db }).update(OPS, { changes: { "alerts.outboxLagMinutes": 21 }, reason, expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 409, details: { code: "STALE_VERSION" } });
    expect(db.actions).toEqual([]);
  });
  it("une autre erreur de base n'est ni rejouée ni déguisée en 409", async () => {
    const db = fakeDb();
    let essais = 0;
    db.$transaction = (async () => { essais++; throw new Error("panne"); }) as typeof db.$transaction;
    await expect(makePlatformSettingsService({ db }).update(SUPER, { changes: { "pricing.commissionPct": 15 }, reason, expectedVersion: 0 })).rejects.toThrow("panne");
    expect(essais).toBe(1);
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
  it("A173 — « Tout réinitialiser » par OPS : ses clés d'exploitation seulement, les clés métier ignorées et nommées, jamais 403 global", async () => {
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS, "pricing.commissionPct": 14, "alerts.outboxLagMinutes": 30 }, version: 2, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const svc = makePlatformSettingsService({ db });
    const r = await svc.reset(OPS, { reason, expectedVersion: 2 });
    expect(r).toEqual({ version: 3, changed: [{ key: "alerts.outboxLagMinutes", before: 30, after: 15 }], skipped: ["pricing.commissionPct"] });
    expect(db.actions.map((a) => `${a.action} ${a.targetId}`)).toEqual(["SETTINGS_RESET alerts.outboxLagMinutes"]);
    expect((db.row()!.values as Record<string, number>)["pricing.commissionPct"]).toBe(14);
    // Plus rien dans sa portée : 400 « rien à remettre », la clé métier restante toujours nommée.
    await expect(svc.reset(OPS, { reason, expectedVersion: 3 })).rejects.toMatchObject({ statusCode: 400, details: { code: "NOTHING_TO_RESET", skipped: ["pricing.commissionPct"] } });
    // SUPER_ADMIN inchangé : tout ce qui s'écarte.
    await expect(svc.reset(SUPER, { reason, expectedVersion: 3 })).resolves.toEqual({ version: 4, changed: [{ key: "pricing.commissionPct", before: 14, after: 12 }] });
  });
  it("ANO-ADM-02 — rien à remettre : un profil sans aucun droit d'écriture est REFUSÉ (403), un profil qui peut écrire reçoit 400", async () => {
    const MEDIATOR = { id: "med1", roles: ["MEDIATOR"] as const };
    const db = fakeDb({ key: "current", values: { ...SETTINGS_DEFAULTS }, version: 2, updatedAt: new Date(), updatedByAdminId: "sa2" });
    const svc = makePlatformSettingsService({ db });
    // Toutes les valeurs sont déjà par défaut : le Médiateur n'a aucune portée d'écriture — refus, pas « rien à faire ».
    await expect(svc.reset(MEDIATOR, { keys: ["pricing.commissionPct"], reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.reset(MEDIATOR, { reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 403 });
    // OPS peut écrire les clés d'exploitation : une remise globale sans effet reste un 400 « Nothing to reset ».
    await expect(svc.reset(OPS, { reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 400 });
    // OPS visant une clé MÉTIER déjà par défaut : il ne peut en écrire aucune → 403.
    await expect(svc.reset(OPS, { keys: ["pricing.commissionPct"], reason, expectedVersion: 2 })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.actions).toEqual([]);
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
  it("ANO-ADM-56 — dernière modification : une version réutilisée (document remis à zéro) ne fusionne pas deux écritures", async () => {
    const db = fakeDb();
    const t = (s: number) => new Date(Date.UTC(2026, 8, 15, 10, 0, s));
    // Deux écritures « version 1 » : une ancienne (autre admin, avant la remise à zéro), la dernière.
    db.adminAction.findMany = async () => [
      { adminUserId: "sa1", createdAt: t(40), after: { key: "alerts.payoutFailedHours", version: 1 } },
      { adminUserId: "ops1", createdAt: t(0), after: { key: "pricing.commissionPct", version: 1 } },
      { adminUserId: "ops1", createdAt: t(0), after: { key: "alerts.outboxLagMinutes", version: 1 } },
    ];
    const r = await makePlatformSettingsService({ db, clock: () => t(50) }).read();
    expect(r.lastChange?.keys).toEqual(["alerts.payoutFailedHours"]);
  });
});
