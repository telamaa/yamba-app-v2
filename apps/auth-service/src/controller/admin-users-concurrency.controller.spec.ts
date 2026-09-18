/**
 * admin-users-concurrency.controller.spec.ts — ANO-ADM-89 : une sanction, un gagnant (recette 02-ADMIN § 7, engagement du § 5.19).
 *
 * Proposer, appliquer, lever : le compte était lu puis écrit sans condition. Trois clics simultanés → 500 (P2034) ou trois
 * lignes de journal, trois emails au membre. L'écriture est conditionnée à l'état lu (`updatedAt`) et rejouée sur conflit
 * d'écriture : au réessai, l'autre décision a gagné → 409 ACCOUNT_STATE_CHANGED, jamais 500, aucune ligne, aucun email.
 */
const T0 = new Date("2026-09-15T10:00:00.000Z");
const T1 = new Date("2026-09-15T10:00:01.000Z");
const ADMIN = "aaaaaaaaaaaaaaaaaaaaaaa1";
const MEMBRE = "bbbbbbbbbbbbbbbbbbbbbbb2";

type Etat = { id: string; updatedAt: Date; accountStatus: string; [k: string]: unknown };
let etat: Etat;
const updateMany = jest.fn(async ({ where, data }: { where: { id: string; updatedAt: Date }; data: Record<string, unknown> }) => {
  if (where.id !== etat.id || where.updatedAt.getTime() !== etat.updatedAt.getTime()) return { count: 0 };
  etat = { ...etat, ...data, updatedAt: new Date(etat.updatedAt.getTime() + 1000) };
  return { count: 1 };
});
const tx = { user: { updateMany } };
const prismaMock = {
  user: { findUnique: jest.fn(async () => ({ ...etat })) },
  $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
};
const auditMock = { recordAdminAction: jest.fn(async () => undefined), recordAdminRead: jest.fn(async () => true) };
const sendAuthEmail = jest.fn(async () => undefined);
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: {} }));
jest.mock("@packages/admin-audit", () => auditMock);
jest.mock("@packages/email", () => ({ isEmailConfigured: () => false, sendTransactionalEmail: jest.fn() }));
jest.mock("../utils/auth.helper", () => ({ revokeRefreshJti: jest.fn(async () => undefined) }));
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeAdminUsersController } = require("./admin-users.controller") as typeof import("./admin-users.controller");

const ctrl = makeAdminUsersController({ activeDeals: async () => [] } as never);
const conflit = () => Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });
const MOTIF = "Annonces frauduleuses signalées trois fois";

async function call(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, body: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await handler({ user: { id: ADMIN }, adminRoles: ["SUPER_ADMIN"], params: { id: MEMBRE }, body, ip: "10.0.0.1", headers: {} } as never, res as never, next as never);
  return { res, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined };
}

/** Le premier essai perd la course : l'autre administrateur a écrit pendant ce temps, la base rejette (P2034). */
function perdreLaCourse(autre: Record<string, unknown>) {
  prismaMock.$transaction.mockImplementationOnce(async () => {
    etat = { ...etat, ...autre, updatedAt: T1 };
    throw conflit();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findUnique.mockReset().mockImplementation(async () => ({ ...etat }));
  prismaMock.$transaction.mockReset().mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  etat = { id: MEMBRE, updatedAt: T0, accountStatus: "ACTIVE", firstName: "Moussa", lastName: "Ba", email: "moussa@example.test", preferredLocale: "fr", emailSuppressedAt: null, roles: ["CUSTOMER"], adminRoles: [] };
});

describe("ANO-ADM-89 — sanctions simultanées : rejouées, un gagnant, 409 pour les autres", () => {
  it("appliquer : P2034 puis l'autre sanction a gagné → 409 ACCOUNT_STATE_CHANGED, aucune ligne, aucun email", async () => {
    perdreLaCourse({ accountStatus: "SUSPENDED" });
    const { error } = await call(ctrl.apply as never, { level: "SUSPENDED", category: "SCAM_SUSPECTED", reason: MOTIF });
    expect(error).toMatchObject({ statusCode: 409, details: { code: "ACCOUNT_STATE_CHANGED" } });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it("appliquer : P2034 puis voie libre → 200 au réessai, une ligne, un email", async () => {
    prismaMock.$transaction.mockImplementationOnce(async () => { throw conflit(); });
    const { res, error } = await call(ctrl.apply as never, { level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF });
    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(etat.accountStatus).toBe("RESTRICTED");
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
  });

  it("trois applications lues au même état : [200, 409, 409], une ligne, un email", async () => {
    const lu = { ...etat };
    prismaMock.user.findUnique.mockResolvedValue(lu as never); // les trois requêtes ont lu AVANT la première écriture
    const r = await Promise.all([0, 1, 2].map(() => call(ctrl.apply as never, { level: "SUSPENDED", category: "SCAM_SUSPECTED", reason: MOTIF })));
    expect(r.map((x) => x.error?.statusCode ?? 200).sort()).toEqual([200, 409, 409]);
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
  });

  it("proposer : deux propositions lues au même état → une seule écrite, l'autre 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...etat } as never);
    const r = await Promise.all([call(ctrl.propose as never, { level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF }), call(ctrl.propose as never, { level: "SUSPENDED", category: "SCAM_SUSPECTED", reason: MOTIF })]);
    expect(r.map((x) => x.error?.statusCode ?? 200).sort()).toEqual([200, 409]);
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
  });

  it("lever : P2034 puis l'autre levée a gagné → 409, aucun email de réactivation en double", async () => {
    etat = { ...etat, accountStatus: "SUSPENDED" };
    perdreLaCourse({ accountStatus: "ACTIVE" });
    const { error } = await call(ctrl.lift as never, { reason: MOTIF });
    expect(error).toMatchObject({ statusCode: 409, details: { code: "ACCOUNT_STATE_CHANGED" } });
    expect(auditMock.recordAdminAction).not.toHaveBeenCalled();
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it("A193 — la catégorie est requise, écrite sur le compte et au journal ; l'email porte son libellé, jamais le motif libre", async () => {
    const sans = await call(ctrl.apply as never, { level: "SUSPENDED", reason: MOTIF });
    expect(sans.error).toMatchObject({ statusCode: 400 });
    const hors = await call(ctrl.apply as never, { level: "SUSPENDED", category: "FRAUDE", reason: MOTIF });
    expect(hors.error).toMatchObject({ statusCode: 400 });
    const ok = await call(ctrl.apply as never, { level: "SUSPENDED", category: "IMPERSONATION", reason: MOTIF });
    expect(ok.error).toBeUndefined();
    expect(etat.suspensionCategory).toBe("IMPERSONATION");
    expect((auditMock.recordAdminAction.mock.calls[0] as unknown[])[1]).toMatchObject({ action: "USER_SUSPENDED", after: { category: "IMPERSONATION", reason: MOTIF } });
    const email = JSON.stringify((sendAuthEmail.mock.calls[0] as unknown[])[2]);
    expect(email).toContain("Usurpation d'identité");
    expect(email).not.toContain(MOTIF);
  });

  it("une autre erreur n'est jamais rejouée", async () => {
    prismaMock.$transaction.mockImplementationOnce(async () => { throw new Error("panne"); });
    const { error } = await call(ctrl.apply as never, { level: "SUSPENDED", category: "SCAM_SUSPECTED", reason: MOTIF });
    expect(error).toMatchObject({ message: "panne" });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

// Cette fiche n'a ni `import` ni `export` en tête : sans cette ligne, TypeScript la traite comme un
// SCRIPT, ses constantes tombent dans la portée globale partagée et se heurtent à celles des fiches
// voisines (TS2451, rapporté sur le fichier VOISIN, invisible pour `nx test`). Piège consigné le 17/09.
export {};
