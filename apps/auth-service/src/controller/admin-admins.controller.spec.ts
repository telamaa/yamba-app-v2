/**
 * admin-admins.controller.spec.ts — la porte du back-office sous gestes simultanés (recette 02-ADMIN § 5.25).
 *
 * ANO-ADM-75 : un compte sans mot de passe réinvité recevait « accès accordé » vers un /login où il ne pouvait rien saisir.
 * ANO-ADM-76 : le lien d'une première invitation revivait quand le compte, retiré, était réinvité.
 * ANO-ADM-77 : trois clics sur « Enregistrer » avec le même lien posaient trois mots de passe (trois lignes de journal).
 * ANO-ADM-78 : deux super administrateurs qui se rétrogradaient au même instant laissaient ZÉRO super administrateur.
 * ANO-ADM-79 : trois invitations simultanées de la même adresse → [201, 500, 500].
 * A189 (§ 5.26) : renvoyer une invitation en attente, motif facultatif du retrait, email à l'admin dont les accès changent.
 */
const store = new Map<string, string>();
const redisMock = {
  get: jest.fn(async (k: string) => store.get(k) ?? null),
  set: jest.fn(async (k: string, v: string) => { store.set(k, v); return "OK"; }),
  del: jest.fn(async (...ks: string[]) => ks.reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0)),
  ttl: jest.fn(async () => 3600),
  scan: jest.fn(async () => ["0", []]),
};
const tx = {
  user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), create: jest.fn() },
  platformSettings: { update: jest.fn() },
};
const prismaMock = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  platformSettings: { upsert: jest.fn() },
  $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
};
const auditMock = { recordAdminAction: jest.fn(async () => undefined) };
const emails = {
  adminInvite: jest.fn(() => ({ subject: "invite" })),
  adminAccessGranted: jest.fn(() => ({ subject: "granted" })),
  adminRolesChanged: jest.fn(() => ({ subject: "roles" })),
  adminAccessRevoked: jest.fn(() => ({ subject: "revoked" })),
};
const sendAuthEmail = jest.fn(async () => undefined);
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }));
jest.mock("@packages/admin-audit", () => auditMock);
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail }));
jest.mock("../emails/admin-emails", () => ({ getAdminEmails: () => emails, adminRoleLabel: (_l: string, r: string) => r }));
jest.mock("../utils/slug.helper", () => ({ generateUniquePublicSlug: async () => "slug" }));
jest.mock("bcryptjs", () => ({ __esModule: true, default: { hash: async () => "hash" } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ctrl = require("./admin-admins.controller") as typeof import("./admin-admins.controller");

const A = "aaaaaaaaaaaaaaaaaaaaaaa1"; // l'acteur
const B = "bbbbbbbbbbbbbbbbbbbbbbb2"; // la cible
const conflit = () => Object.assign(new Error("Transaction failed due to a write conflict"), { code: "P2034" });
const req = (extra: Record<string, unknown>) => ({ user: { id: A, firstName: "Sacha", lastName: "S" }, ip: "10.0.0.1", headers: { "user-agent": "jest" }, params: {}, body: {}, ...extra }) as never;
async function call(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, rq: never) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await handler(rq, res as never, next as never);
  return { res, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined };
}

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
});

describe("A186 — il reste toujours un super administrateur en service (ANO-ADM-78)", () => {
  it("rétrogradation croisée : le perdant est rejoué, recompte zéro autre super administrateur → 403 LAST_SUPER_ADMIN, aucune ligne", async () => {
    tx.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, adminRole: "SUPER_ADMIN", adminRoles: ["SUPER_ADMIN"], roles: ["ADMIN"] });
    prismaMock.$transaction.mockRejectedValueOnce(conflit()); // l'autre rétrogradation a écrit la garde pendant ce premier essai
    tx.user.count.mockResolvedValue(0); // au réessai : l'acteur a été rétrogradé, plus personne en service
    const { error } = await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["SUPPORT"] } }));
    expect(error).toMatchObject({ statusCode: 403, details: { code: "LAST_SUPER_ADMIN" } });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.platformSettings.update).toHaveBeenCalledWith({ where: { key: "admin-accounts" }, data: { version: { increment: 1 } } });
    expect(tx.user.count).toHaveBeenCalledWith({ where: expect.objectContaining({ id: { not: B }, totpEnabledAt: { not: null }, passwordHash: { not: null } }) });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
  });
  it("un autre super administrateur en service → la rétrogradation passe, la garde est écrite dans la même transaction", async () => {
    tx.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, adminRole: "SUPER_ADMIN", adminRoles: ["SUPER_ADMIN"], roles: ["ADMIN"] });
    tx.user.count.mockResolvedValue(1);
    const { res, error } = await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["SUPPORT"] } }));
    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(tx.platformSettings.update).toHaveBeenCalledTimes(1);
    expect(auditMock.recordAdminAction).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "ADMIN_ROLE_CHANGED", before: { adminRoles: ["SUPER_ADMIN"] }, after: { adminRoles: ["SUPPORT"] } }));
  });
  it("un profil qui ne touche pas SUPER_ADMIN ne compte rien et n'écrit pas la garde", async () => {
    tx.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, adminRole: "SUPPORT", adminRoles: ["SUPPORT"], roles: ["ADMIN"] });
    await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["SUPPORT", "FINANCE"] } }));
    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.platformSettings.update).not.toHaveBeenCalled();
  });
  it("retirer le dernier super administrateur en service → 403 ; soi-même → 403 ADMIN_IS_SELF sans lecture", async () => {
    tx.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, adminRole: "SUPER_ADMIN", adminRoles: ["SUPER_ADMIN"], roles: ["ADMIN"] });
    tx.user.count.mockResolvedValue(0);
    expect((await call(ctrl.revokeAdmin as never, req({ params: { id: B } }))).error).toMatchObject({ statusCode: 403, details: { code: "LAST_SUPER_ADMIN" } });
    jest.clearAllMocks();
    expect((await call(ctrl.revokeAdmin as never, req({ params: { id: A } }))).error).toMatchObject({ statusCode: 403, details: { code: "ADMIN_IS_SELF" } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("A185 — invitations : un lien vivant par compte, à usage unique", () => {
  it("ANO-ADM-75/76 — compte existant SANS mot de passe : lien de mot de passe (jamais « accès accordé »), l'ancien lien meurt", async () => {
    store.set(`admin_invite_user:${B}`, "ancien");
    store.set("admin_invite:ancien", B);
    const membre = { id: B, isDeleted: false, email: "oda@x.dev", firstName: "Oda", passwordHash: null, adminRole: null, adminRoles: [], roles: [], totpBackupCodeHashes: [], preferredLocale: "fr" };
    prismaMock.user.findUnique.mockResolvedValue(membre);
    tx.user.findUnique.mockResolvedValue(membre);
    const { res, error } = await call(ctrl.inviteAdmin as never, req({ body: { email: "oda@x.dev", firstName: "Oda", lastName: "O", adminRoles: ["OPS"] } }));
    expect(error).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ existingAccount: true, passwordRequired: true }));
    expect(emails.adminInvite).toHaveBeenCalledTimes(1);
    expect(emails.adminAccessGranted).not.toHaveBeenCalled();
    expect(store.has("admin_invite:ancien")).toBe(false);
    const nouveau = store.get(`admin_invite_user:${B}`)!;
    expect(store.get(`admin_invite:${nouveau}`)).toBe(B);
  });
  it("membre AVEC mot de passe → « accès accordé », aucun jeton", async () => {
    const membre = { id: B, isDeleted: false, email: "a@x.dev", firstName: "A", passwordHash: "h", adminRole: null, adminRoles: [], roles: ["SHIPPER"], totpBackupCodeHashes: [], preferredLocale: "fr" };
    prismaMock.user.findUnique.mockResolvedValue(membre);
    tx.user.findUnique.mockResolvedValue(membre);
    const { res } = await call(ctrl.inviteAdmin as never, req({ body: { email: "a@x.dev", firstName: "A", lastName: "B", adminRoles: ["SUPPORT"] } }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ existingAccount: true, passwordRequired: false }));
    expect(emails.adminAccessGranted).toHaveBeenCalledTimes(1);
    expect(tx.user.update.mock.calls[0][0].data.roles).toEqual(["SHIPPER", "ADMIN"]);
    expect(store.size).toBe(0);
  });
  it("invitations simultanées d'un membre : la rejouée relit le profil posé → 400 ADMIN_ALREADY_GRANTED, aucune ligne", async () => {
    const avant = { id: B, isDeleted: false, email: "a@x.dev", firstName: "A", passwordHash: "h", adminRole: null, adminRoles: [], roles: ["SHIPPER"] };
    prismaMock.user.findUnique.mockResolvedValue(avant);
    prismaMock.$transaction.mockRejectedValueOnce(conflit());
    tx.user.findUnique.mockResolvedValue({ ...avant, adminRole: "SUPPORT", adminRoles: ["SUPPORT"] });
    const { error } = await call(ctrl.inviteAdmin as never, req({ body: { email: "a@x.dev", firstName: "A", lastName: "B", adminRoles: ["SUPPORT"] } }));
    expect(error).toMatchObject({ statusCode: 400, details: { code: "ADMIN_ALREADY_GRANTED" } });
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });
  it("ANO-ADM-79 — adresse inconnue, collision d'unicité (P2002) → 400 ADMIN_ALREADY_GRANTED, ni jeton ni email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const { error } = await call(ctrl.inviteAdmin as never, req({ body: { email: "tao@x.dev", firstName: "Tao", lastName: "T", adminRoles: ["SUPPORT"] } }));
    expect(error).toMatchObject({ statusCode: 400, details: { code: "ADMIN_ALREADY_GRANTED" } });
    expect(store.size).toBe(0);
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });
  it("un compte supprimé n'est jamais promu (400 ACCOUNT_DELETED)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: B, isDeleted: true, passwordHash: "h", adminRole: null, adminRoles: [] });
    const { error } = await call(ctrl.inviteAdmin as never, req({ body: { email: "d@x.dev", firstName: "D", lastName: "D", adminRoles: ["SUPPORT"] } }));
    expect(error).toMatchObject({ statusCode: 400, details: { code: "ACCOUNT_DELETED" } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  it("« Retirer » efface le lien en attente (il revivrait à la réinvitation)", async () => {
    store.set(`admin_invite_user:${B}`, "t1");
    store.set("admin_invite:t1", B);
    tx.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, adminRole: "SUPPORT", adminRoles: ["SUPPORT"], roles: ["ADMIN"] });
    const { error } = await call(ctrl.revokeAdmin as never, req({ params: { id: B } }));
    expect(error).toBeUndefined();
    expect(store.size).toBe(0);
  });
  it("ANO-ADM-77 — le lien est réclamé avant d'écrire : un second clic (DEL rend 0) lit 400, aucune écriture", async () => {
    const invite = { id: B, isDeleted: false, email: "i@x.dev", firstName: "Inès", lastName: "I", adminRole: "SUPPORT", adminRoles: ["SUPPORT"] };
    prismaMock.user.findUnique.mockResolvedValue(invite);
    store.set("admin_invite:" + "t".repeat(64), B);
    redisMock.del.mockResolvedValueOnce(0); // un autre clic l'a réclamé entre la lecture et la réclamation
    const token = "t".repeat(64);
    const { error } = await call(ctrl.acceptAdminInvite as never, req({ body: { token, password: "Recette-Porte-2026!" } }));
    expect(error).toMatchObject({ statusCode: 400, details: { code: "INVITATION_INVALID" } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    // Le premier clic, lui, pose le mot de passe et journalise une fois.
    const ok = await call(ctrl.acceptAdminInvite as never, req({ body: { token, password: "Recette-Porte-2026!" } }));
    expect(ok.error).toBeUndefined();
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect(store.has("admin_invite:" + token)).toBe(false);
  });
  it("une écriture qui échoue rend le lien (il n'a pas servi)", async () => {
    const token = "u".repeat(64);
    prismaMock.user.findUnique.mockResolvedValue({ id: B, isDeleted: false, email: "i@x.dev", firstName: "Inès", lastName: "I", adminRole: "SUPPORT", adminRoles: ["SUPPORT"] });
    store.set("admin_invite:" + token, B);
    prismaMock.$transaction.mockRejectedValueOnce(new Error("panne"));
    const { error } = await call(ctrl.acceptAdminInvite as never, req({ body: { token, password: "Recette-Porte-2026!" } }));
    expect((error as unknown as Error).message).toBe("panne");
    expect(store.get("admin_invite:" + token)).toBe(B);
  });
});

describe("A189 — renvoyer, motiver, prévenir (lots décidés au § 5.25)", () => {
  const invite = { id: B, isDeleted: false, email: "i@x.dev", firstName: "Inès", lastName: "I", preferredLocale: "fr", passwordHash: null, adminRole: "SUPPORT", adminRoles: ["SUPPORT"], roles: ["ADMIN"], emailSuppressedAt: null };

  it("a — invitation en attente : nouveau lien, l'ancien meurt, email, une ligne ADMIN_INVITE_RESENT ; la liste dit jusqu'à quand", async () => {
    store.set("admin_invite:ancien", B);
    store.set(`admin_invite_user:${B}`, "ancien");
    prismaMock.user.findUnique.mockResolvedValue(invite);
    const { res, error } = await call(ctrl.resendAdminInvite as never, req({ params: { id: B } }));
    expect(error).toBeUndefined();
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, inviteExpiresAt: expect.any(String) });
    expect(store.has("admin_invite:ancien")).toBe(false);
    const nouveau = store.get(`admin_invite_user:${B}`)!;
    expect(nouveau).not.toBe("ancien");
    expect(store.get(`admin_invite:${nouveau}`)).toBe(B);
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
    expect(emails.adminInvite).toHaveBeenCalledWith(expect.objectContaining({ acceptUrl: expect.stringContaining(nouveau) }));
    expect((auditMock.recordAdminAction.mock.calls as unknown[][]).map((c) => (c[1] as { action: string }).action)).toEqual(["ADMIN_INVITE_RESENT"]);

    prismaMock.user.findMany.mockResolvedValue([{ ...invite, totpEnabledAt: null, createdAt: new Date() }, { ...invite, id: A, passwordHash: "h", totpEnabledAt: new Date(), createdAt: new Date() }]);
    const liste = await call(ctrl.listAdmins as never, req({}));
    const items = liste.res.json.mock.calls[0][0].items as Array<{ id: string; inviteExpiresAt: string | null }>;
    expect(items.find((i) => i.id === B)!.inviteExpiresAt).toEqual(expect.any(String)); // ttl mocké : 3600 s
    expect(items.find((i) => i.id === A)!.inviteExpiresAt).toBeNull(); // invitation acceptée : rien à dire
  });

  it("a — invitation acceptée → 409 ADMIN_INVITE_NOT_PENDING ; compte inconnu → 404 ; ni lien, ni email, ni ligne", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...invite, passwordHash: "h" });
    expect((await call(ctrl.resendAdminInvite as never, req({ params: { id: B } }))).error).toMatchObject({ statusCode: 409, details: { code: "ADMIN_INVITE_NOT_PENDING" } });
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...invite, adminRole: null, adminRoles: [] });
    expect((await call(ctrl.resendAdminInvite as never, req({ params: { id: B } }))).error).toMatchObject({ statusCode: 409 });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    expect((await call(ctrl.resendAdminInvite as never, req({ params: { id: B } }))).error).toMatchObject({ statusCode: 404 });
    expect(store.size).toBe(0);
    expect(sendAuthEmail).not.toHaveBeenCalled();
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
  });

  it("b + c — retrait avec motif : le motif va au journal, l'email « accès retiré » part SANS motif ; sans motif : aucune clé after", async () => {
    tx.user.findUnique.mockResolvedValue({ ...invite, passwordHash: "h" });
    prismaMock.user.findUnique.mockResolvedValue({ ...invite, adminRole: null, adminRoles: [], roles: [] });
    const { error } = await call(ctrl.revokeAdmin as never, req({ params: { id: B }, body: { reason: "  Compte compromis signalé par l'intéressée  " } }));
    expect(error).toBeUndefined();
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ action: "ADMIN_REVOKED", after: { reason: "Compte compromis signalé par l'intéressée" } });
    expect(emails.adminAccessRevoked).toHaveBeenCalledWith({ firstName: "Inès", revokedBy: "Sacha S", supportEmail: expect.any(String) });
    expect(sendAuthEmail).toHaveBeenCalledWith("i@x.dev", "fr", { subject: "revoked" });

    jest.clearAllMocks();
    await call(ctrl.revokeAdmin as never, req({ params: { id: B }, body: { reason: "   " } }));
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).not.toHaveProperty("after");
    expect((await call(ctrl.revokeAdmin as never, req({ params: { id: B }, body: { reason: "x".repeat(501) } }))).error).toMatchObject({ statusCode: 400 });
  });

  it("c — profils changés : email avant → après ; même liste dans un autre ordre : rien ; adresse suppressionnée ou compte supprimé : rien", async () => {
    tx.user.findUnique.mockResolvedValue({ ...invite, passwordHash: "h", adminRoles: ["SUPPORT", "FINANCE"], adminRole: "SUPPORT" });
    prismaMock.user.findUnique.mockResolvedValue({ ...invite, passwordHash: "h" });
    await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["SUPPORT"] } }));
    expect(emails.adminRolesChanged).toHaveBeenCalledWith(expect.objectContaining({ before: "SUPPORT + FINANCE", after: "SUPPORT", changedBy: "Sacha S" }));
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["FINANCE", "SUPPORT"] } }));
    expect(sendAuthEmail).not.toHaveBeenCalled();

    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ ...invite, emailSuppressedAt: new Date() });
    await call(ctrl.updateAdminRole as never, req({ params: { id: B }, body: { adminRoles: ["OPS"] } }));
    prismaMock.user.findUnique.mockResolvedValue({ ...invite, isDeleted: true });
    await call(ctrl.revokeAdmin as never, req({ params: { id: B } }));
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });
});
