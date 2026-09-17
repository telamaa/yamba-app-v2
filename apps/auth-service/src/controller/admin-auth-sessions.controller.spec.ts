/**
 * admin-auth-sessions.controller.spec.ts — « Mes sessions » et la déconnexion admin (recette 02-ADMIN § 5.26, A188).
 *
 * ANO-ADM-81 : les sessions ne se distinguaient que par leurs dates — ni appareil ni IP, alors que la page dit « Révoque ce
 *              que tu ne reconnais pas » et que l'alerte email les donne.
 * ANO-ADM-83 : une déconnexion rejouée (deuxième onglet, double clic) écrivait une seconde ligne ADMIN_LOGOUT ; révoquer une
 *              session déjà fermée écrivait ADMIN_SESSION_REVOKED et répondait 200.
 */
import jwt from "jsonwebtoken";

const store = new Map<string, string>();
const redisMock = {
  get: jest.fn(async (k: string) => store.get(k) ?? null),
  set: jest.fn(async (k: string, v: string, ...opts: unknown[]) => {
    if (opts.includes("NX") && store.has(k)) return null;
    store.set(k, v);
    return "OK";
  }),
  incr: jest.fn(async (k: string) => { const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; }),
  expire: jest.fn(async () => 1),
  del: jest.fn(async (...ks: string[]) => ks.reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0)),
  exists: jest.fn(async (k: string) => (store.has(k) ? 1 : 0)),
  scan: jest.fn(async (_c: string, _m: string, pattern: string) => ["0", [...store.keys()].filter((k) => k.startsWith(pattern.replace("*", "")))]),
};
const prismaMock = { user: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) }, $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) };
const auditMock = { recordAdminAction: jest.fn(async () => undefined), recordAdminRead: jest.fn(async () => undefined) };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }));
jest.mock("@packages/admin-audit", () => auditMock);
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail: jest.fn(async () => undefined) }));

process.env.REFRESH_TOKEN_SECRET = "refresh-secret-de-test";
process.env.ACCESS_TOKEN_SECRET = "access-secret-de-test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ctrl = require("./admin-auth.controller") as typeof import("./admin-auth.controller");

const ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const JTI_A = "a".repeat(32);
const JTI_B = "b".repeat(32);
const cle = (jti: string) => `admin_jti:${ID}:${jti}`;
const refresh = (jti: string, sca = Date.now()) => jwt.sign({ id: ID, jti, adm: true, sca }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: 3600 });
const UA_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0";

async function call(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, rq: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  const next = jest.fn();
  await handler({ ip: "10.0.0.7", headers: {}, cookies: {}, params: {}, body: {}, ...rq } as never, res as never, next as never);
  return { res, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined };
}

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
});

describe("A188 b — le journal ne compte que les sessions réellement fermées (ANO-ADM-83)", () => {
  it("déconnexion puis rejeu du même jeton : 200 les deux fois, UNE ligne ADMIN_LOGOUT", async () => {
    store.set(cle(JTI_A), JSON.stringify({ createdAt: Date.now(), lastActivityAt: Date.now() }));
    const jeton = refresh(JTI_A);
    const premier = await call(ctrl.adminLogout as never, { cookies: { admin_refresh_token: jeton } });
    const rejeu = await call(ctrl.adminLogout as never, { cookies: { admin_refresh_token: jeton } });
    expect(premier.res.status).toHaveBeenCalledWith(200);
    expect(rejeu.res.status).toHaveBeenCalledWith(200);
    expect(store.has(cle(JTI_A))).toBe(false);
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ adminUserId: ID, action: "ADMIN_LOGOUT", targetType: "SESSION" });
  });

  it("révoquer une session absente → 404 ADMIN_SESSION_NOT_FOUND, aucune ligne ; une session vivante → 200 et sa ligne", async () => {
    store.set(cle(JTI_B), JSON.stringify({ createdAt: Date.now(), lastActivityAt: Date.now() }));
    const user = { id: ID };
    const absente = await call(ctrl.revokeAdminSessionById as never, { user, params: { jti: JTI_A } });
    expect(absente.error).toMatchObject({ statusCode: 404, details: { code: "ADMIN_SESSION_NOT_FOUND" } });
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
    const vivante = await call(ctrl.revokeAdminSessionById as never, { user, params: { jti: JTI_B } });
    expect(vivante.res.status).toHaveBeenCalledWith(200);
    const doublon = await call(ctrl.revokeAdminSessionById as never, { user, params: { jti: JTI_B } });
    expect(doublon.error).toMatchObject({ statusCode: 404 });
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ action: "ADMIN_SESSION_REVOKED", targetId: JTI_B });
  });
});

describe("A188 a — une session se reconnaît : appareil et IP, gardés à la rotation (ANO-ADM-81)", () => {
  it("la liste sert appareil et IP ; une session d'avant la correction dit « Appareil inconnu » et ip null", async () => {
    const t = Date.now();
    store.set(cle(JTI_A), JSON.stringify({ createdAt: t, lastActivityAt: t, ip: "10.0.0.7", userAgent: UA_FIREFOX, device: "Firefox · Windows" }));
    store.set(cle(JTI_B), JSON.stringify({ createdAt: t - 1000, lastActivityAt: t - 1000 }));
    const { res } = await call(ctrl.listAdminSessions as never, { user: { id: ID }, cookies: { admin_refresh_token: refresh(JTI_A) } });
    const { items } = res.json.mock.calls[0][0] as { items: Array<Record<string, unknown>> };
    expect(items).toEqual([
      expect.objectContaining({ jti: JTI_A, current: true, device: "Firefox · Windows", ip: "10.0.0.7" }),
      expect.objectContaining({ jti: JTI_B, current: false, device: "Appareil inconnu", ip: null }),
    ]);
    expect(items[0]).not.toHaveProperty("userAgent"); // l'user-agent brut reste en Redis : l'écran lit le libellé
  });

  it("renouvellement : le nouveau jti hérite de l'appareil et de l'IP d'OUVERTURE, pas de ceux de la requête", async () => {
    const t = Date.now();
    store.set(cle(JTI_A), JSON.stringify({ createdAt: t, lastActivityAt: t, ip: "10.0.0.7", userAgent: UA_FIREFOX, device: "Firefox · Windows" }));
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, roles: ["ADMIN"], isDeleted: false, totpEnabledAt: new Date() });
    const { res, error } = await call(ctrl.adminRefresh as never, { ip: "192.168.1.50", headers: { "user-agent": "curl/8" }, cookies: { admin_refresh_token: refresh(JTI_A, t) } });
    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    const restantes = [...store.entries()].filter(([k]) => k.startsWith(`admin_jti:${ID}:`));
    expect(restantes).toHaveLength(1);
    expect(restantes[0][0]).not.toBe(cle(JTI_A));
    expect(JSON.parse(restantes[0][1])).toMatchObject({ createdAt: t, ip: "10.0.0.7", device: "Firefox · Windows" });
  });

  it("une session d'avant la correction prend, au renouvellement, l'appareil de la requête (elle devient reconnaissable)", async () => {
    const t = Date.now();
    store.set(cle(JTI_A), JSON.stringify({ createdAt: t, lastActivityAt: t }));
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, roles: ["ADMIN"], isDeleted: false, totpEnabledAt: new Date() });
    await call(ctrl.adminRefresh as never, { ip: "10.0.0.9", headers: { "user-agent": UA_FIREFOX }, cookies: { admin_refresh_token: refresh(JTI_A, t) } });
    const [, valeur] = [...store.entries()].find(([k]) => k.startsWith(`admin_jti:${ID}:`))!;
    expect(JSON.parse(valeur)).toMatchObject({ ip: "10.0.0.9", device: "Firefox · Windows", userAgent: UA_FIREFOX });
  });
});

describe("A190 (recette 02-ADMIN § 6) — lots du § 5.26", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const totp = require("@packages/totp") as typeof import("@packages/totp");

  it("c — le jeton renouvelé porte les profils admin, comme celui de l'ouverture", async () => {
    const t = Date.now();
    store.set(cle(JTI_A), JSON.stringify({ createdAt: t, lastActivityAt: t }));
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, roles: ["ADMIN"], isDeleted: false, totpEnabledAt: new Date(), adminRole: "FINANCE", adminRoles: ["FINANCE", "SUPPORT"] });
    const { res } = await call(ctrl.adminRefresh as never, { cookies: { admin_refresh_token: refresh(JTI_A, t) } });
    const acces = res.cookie.mock.calls.find((c: unknown[]) => c[0] === "admin_access_token")?.[1] as string;
    expect(jwt.verify(acces, process.env.ACCESS_TOKEN_SECRET as string)).toMatchObject({ id: ID, adm: true, amr: ["pwd", "totp"], adminRole: "FINANCE" });
    expect(new Set((jwt.decode(acces) as { adminRoles: string[] }).adminRoles)).toEqual(new Set(["FINANCE", "SUPPORT"]));
  });

  it("d — deux renouvellements simultanés du même jeton : UNE session suivante, les deux onglets la reçoivent", async () => {
    const t = Date.now();
    store.set(cle(JTI_A), JSON.stringify({ createdAt: t, lastActivityAt: t, device: "Firefox · Windows", ip: "10.0.0.7" }));
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, roles: ["ADMIN"], isDeleted: false, totpEnabledAt: new Date() });
    const jeton = refresh(JTI_A, t);
    const [a, b] = await Promise.all([call(ctrl.adminRefresh as never, { cookies: { admin_refresh_token: jeton } }), call(ctrl.adminRefresh as never, { cookies: { admin_refresh_token: jeton } })]);
    expect([a.error, b.error]).toEqual([undefined, undefined]);
    const sessions = [...store.keys()].filter((k) => k.startsWith(`admin_jti:${ID}:`));
    expect(sessions).toHaveLength(1); // aucune session fantôme
    const jtiDe = (r: typeof a) => (jwt.decode(r.res.cookie.mock.calls.find((c: unknown[]) => c[0] === "admin_refresh_token")?.[1] as string) as { jti: string }).jti;
    expect(jtiDe(a)).toBe(jtiDe(b));
    expect(sessions[0]).toBe(cle(jtiDe(a)));
  });

  it("d — hors fenêtre de grâce (aucun successeur), un vieux jeton rejoué est refusé : 401 ADMIN_SESSION_EXPIRED", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, roles: ["ADMIN"], isDeleted: false, totpEnabledAt: new Date() });
    const { error } = await call(ctrl.adminRefresh as never, { cookies: { admin_refresh_token: refresh(JTI_B) } });
    expect(error).toMatchObject({ statusCode: 401, details: { code: "ADMIN_SESSION_EXPIRED" } });
  });

  it("b — révoquer toutes mes autres sessions : la courante reste, UNE ligne avec le nombre ; rien à fermer → aucune ligne", async () => {
    const t = Date.now();
    const JTI_C = "c".repeat(32);
    for (const j of [JTI_A, JTI_B, JTI_C]) store.set(cle(j), JSON.stringify({ createdAt: t, lastActivityAt: t }));
    const rq = { user: { id: ID }, cookies: { admin_refresh_token: refresh(JTI_A) } };
    const premier = await call(ctrl.revokeOtherAdminSessions as never, rq);
    expect(premier.res.json).toHaveBeenCalledWith({ ok: true, revoked: 2 });
    expect([...store.keys()]).toEqual([cle(JTI_A)]);
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ action: "ADMIN_SESSIONS_REVOKED", targetType: "SESSION", after: { count: 2 } });
    const rejeu = await call(ctrl.revokeOtherAdminSessions as never, rq);
    expect(rejeu.res.json).toHaveBeenCalledWith({ ok: true, revoked: 0 });
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
  });

  it("a — régénérer ses codes : code TOTP valide → dix nouveaux codes, anciens remplacés dans la même transaction que la ligne", async () => {
    const secret = totp.generateTotpSecret();
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, totpEnabledAt: new Date(), totpSecretEncrypted: totp.encryptTotpSecret(secret), totpLastUsedStep: null, totpBackupCodeHashes: ["h1"] });
    const { res, error } = await call(ctrl.regenerateAdminBackupCodes as never, { user: { id: ID }, body: { code: totp.totpCode(secret) } });
    expect(error).toBeUndefined();
    const { backupCodes } = res.json.mock.calls[0][0] as { backupCodes: string[] };
    expect(backupCodes.length).toBeGreaterThanOrEqual(8);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ecrit = (prismaMock.user.updateMany.mock.calls[0] as unknown[])[0] as { data: { totpBackupCodeHashes: string[] } };
    expect(ecrit.data.totpBackupCodeHashes).toEqual(backupCodes.map(totp.hashBackupCode));
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ action: "ADMIN_BACKUP_CODES_REGENERATED", before: { remaining: 1 }, after: { remaining: backupCodes.length } });
    expect(JSON.stringify(auditMock.recordAdminAction.mock.calls)).not.toContain(backupCodes[0]); // jamais un code en clair au journal
  });

  it("a — mauvais code, ou un code de secours : 400 OTP_INCORRECT (jamais 401 : la session reste valide), rien d'écrit", async () => {
    const secret = totp.generateTotpSecret();
    prismaMock.user.findUnique.mockResolvedValue({ id: ID, totpEnabledAt: new Date(), totpSecretEncrypted: totp.encryptTotpSecret(secret), totpLastUsedStep: null, totpBackupCodeHashes: [] });
    for (const code of ["000000", "ABCD-EFGH"]) {
      const { error } = await call(ctrl.regenerateAdminBackupCodes as never, { user: { id: ID }, body: { code } });
      expect(error).toMatchObject({ statusCode: 400, details: { code: "OTP_INCORRECT" } });
    }
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
  });
});
