/**
 * privacy-requests.controller.spec.ts — ANO-ADM-57 : une ouverture du registre RGPD, une ligne de journal
 * (recette 02-ADMIN § 5.21, fiche ADM-RGP-1, majeure).
 *
 * L'écran lit le registre deux fois à l'ouverture : deux lignes `DATA_REQUESTS_VIEWED` pour une consultation. La première page
 * passe par `recordAdminRead` (coalescence A168) ; « Charger la suite » (curseur) est une nouvelle lecture, toujours écrite.
 */
const prismaMock = { dataRequest: { findMany: jest.fn() }, user: { findMany: jest.fn() } };
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
const { listDataRequests } = require("./privacy.controller") as typeof import("./privacy.controller");

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
