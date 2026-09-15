/**
 * privacy-requests.controller.spec.ts — ANO-ADM-57 : une ouverture du registre RGPD, une ligne de journal
 * (recette 02-ADMIN § 5.21, fiche ADM-RGP-1, majeure).
 *
 * L'écran lit le registre deux fois à l'ouverture : deux lignes `DATA_REQUESTS_VIEWED` pour une consultation. La première page
 * passe par `recordAdminRead` (coalescence A168) ; « Charger la suite » (curseur) est une nouvelle lecture, toujours écrite.
 */
const prismaMock = { dataRequest: { findMany: jest.fn() }, user: { findMany: jest.fn(), findUnique: jest.fn() }, booking: { count: jest.fn() }, trip: { count: jest.fn() } };
const auditMock = { recordAdminAction: jest.fn(async () => undefined), recordAdminRead: jest.fn(async () => true) };
const redisMock = { set: jest.fn() };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }), { virtual: true });
jest.mock("@packages/admin-audit", () => auditMock, { virtual: true });
jest.mock("@packages/libs/imagekit", () => ({ deleteImageKitFile: jest.fn() }), { virtual: true });
jest.mock("../utils/auth.helper", () => ({ checkSudoOtpRestrictions: jest.fn(), revokeRefreshJti: jest.fn(), sendSudoOtp: jest.fn(), trackSudoOtpRequests: jest.fn() }));
jest.mock("../utils/sudo", () => ({ requireSudo: jest.fn() }));
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail: jest.fn() }));
jest.mock("../emails/auth-emails", () => ({ getAuthEmails: jest.fn() }));
jest.mock("../utils/consent/consent.helper", () => ({ recordCookiesConsent: jest.fn() }));

// require après les mocks : le contrôleur construit son service au chargement (les imports seraient remontés avant les constantes).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { adminErasureBlockers, listDataRequests } = require("./privacy.controller") as typeof import("./privacy.controller");

const row = (id: string) => ({ id, userId: "u1", requestedByAdminId: null, type: "EXPORT", channel: "MEMBER", status: "DONE", refusalReasons: [], reason: null, requestedAt: new Date("2026-09-15T10:00:00Z"), completedAt: null });
const call = async (query: Record<string, string>) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await listDataRequests({ query, user: { id: "adm-1" }, ip: "10.0.0.1", headers: { "user-agent": "jest" } } as never, res as never, next);
  expect(next).not.toHaveBeenCalled();
  return res;
};

describe("GET /admin/privacy/requests — la consultation est journalisée une fois", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.dataRequest.findMany.mockResolvedValue([row("aaaaaaaaaaaaaaaaaaaaaaa1")]);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", firstName: "Awa", lastName: "Diop", isDeleted: false }]);
  });

  it("première page : lecture d'écran coalescée (recordAdminRead avec Redis), jamais recordAdminAction", async () => {
    const res = await call({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(auditMock.recordAdminRead).toHaveBeenCalledTimes(1);
    expect(auditMock.recordAdminRead).toHaveBeenCalledWith(prismaMock, redisMock, expect.objectContaining({ adminUserId: "adm-1", action: "DATA_REQUESTS_VIEWED", targetType: "USER", targetId: null, after: { rows: 1 } }));
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
  });

  it("« Charger la suite » (curseur) : une nouvelle lecture, toujours écrite", async () => {
    await call({ cursor: "aaaaaaaaaaaaaaaaaaaaaaa0" });
    expect(auditMock.recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "DATA_REQUESTS_VIEWED", after: { rows: 1 } }));
    expect(auditMock.recordAdminRead).not.toHaveBeenCalled();
  });
});

describe("A179 (recette § 5.22) — le registre d'un membre et les bloqueurs avant le clic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.dataRequest.findMany.mockResolvedValue([row("aaaaaaaaaaaaaaaaaaaaaaa1")]);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", firstName: "Awa", lastName: "Diop", isDeleted: false }]);
  });

  it("?userId= : seules ses demandes, et la ligne de journal porte le membre en cible", async () => {
    const U = "bbbbbbbbbbbbbbbbbbbbbbbb";
    await call({ userId: U });
    expect(prismaMock.dataRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: U } }));
    expect(auditMock.recordAdminRead).toHaveBeenCalledWith(prismaMock, redisMock, expect.objectContaining({ action: "DATA_REQUESTS_VIEWED", targetType: "USER", targetId: U }));
  });
  it("sans filtre : tout le registre, cible nulle ; filtre illisible → 400 INVALID_ID, rien lu", async () => {
    await call({});
    expect(prismaMock.dataRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    prismaMock.dataRequest.findMany.mockClear();
    await listDataRequests({ query: { userId: "pas-un-id" }, user: { id: "adm-1" }, headers: {} } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, details: { code: "INVALID_ID" } }));
    expect(prismaMock.dataRequest.findMany).not.toHaveBeenCalled();
  });
  it("GET /admin/users/:id/erasure-blockers : la liste fermée, non journalisée ; compte effacé → 404", async () => {
    const U = "cccccccccccccccccccccccc";
    prismaMock.user.findUnique.mockImplementation(async (args: { select: Record<string, boolean> }) => ("adminRoles" in args.select ? { adminRoles: [], adminRole: null, roles: ["SHIPPER"] } : { id: U, isDeleted: false }));
    prismaMock.booking.count.mockImplementation(async (args: { where: { status: unknown } }) => (args.where.status === "PENDING" ? 2 : 0));
    prismaMock.trip.count.mockResolvedValue(0);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminErasureBlockers({ params: { id: U }, user: { id: "adm-1" } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ blockers: ["PENDING_REQUEST"], counts: expect.objectContaining({ PENDING_REQUEST: 2, ACTIVE_DEAL: 0 }) });
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
    expect(auditMock.recordAdminRead).not.toHaveBeenCalled();

    prismaMock.user.findUnique.mockResolvedValue({ id: U, isDeleted: true });
    const next404 = jest.fn();
    await adminErasureBlockers({ params: { id: U }, user: { id: "adm-1" } } as never, { status: jest.fn().mockReturnThis(), json: jest.fn() } as never, next404);
    expect(next404).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
