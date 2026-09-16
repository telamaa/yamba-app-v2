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
  set: jest.fn(async (k: string, v: string) => { store.set(k, v); return "OK"; }),
  del: jest.fn(async (...ks: string[]) => ks.reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0)),
  exists: jest.fn(async (k: string) => (store.has(k) ? 1 : 0)),
  scan: jest.fn(async (_c: string, _m: string, pattern: string) => ["0", [...store.keys()].filter((k) => k.startsWith(pattern.replace("*", "")))]),
};
const prismaMock = { user: { findUnique: jest.fn() } };
const auditMock = { recordAdminAction: jest.fn(async () => undefined), recordAdminRead: jest.fn(async () => undefined) };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }), { virtual: true });
jest.mock("@packages/admin-audit", () => auditMock, { virtual: true });
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
