/**
 * auth-concurrency.controller.spec.ts — A195 : une lecture d'unicité ne réserve rien (passe concurrence MEMBRE)
 * ==============================================================================================================
 * Suite d'A192, côté membre. Deux chemins d'authentification lisaient puis écrivaient sans condition :
 *
 *  - VALIDER LE CODE D'INSCRIPTION : « cet email est-il libre ? » est vrai au moment de la lecture, et faux
 *    une milliseconde plus tard. Deux validations du même code (double clic, requête rejouée par le
 *    navigateur) créaient toutes deux le compte ; la seconde recevait un 500 sur l'index unique alors que la
 *    bonne réponse était déjà écrite noir sur blanc plus haut dans la fonction : EMAIL_ALREADY_USED.
 *    Le slug public, lui, est un TIRAGE : deux tirages identiques ne sont pas une réponse au membre, on retire.
 *  - RÉINITIALISER LE MOT DE PASSE : le refus « même mot de passe qu'avant » porte sur l'empreinte LUE. Si le
 *    mot de passe change entre la lecture et l'écriture, l'écriture sans condition l'écrasait en silence.
 */
const prismaMock = {
  user: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
};
const helpers = {
  verifyOtp: jest.fn(async () => undefined),
  getEmailKeyFromToken: jest.fn(async () => "awa.diop@example.test"),
  getPendingRegistration: jest.fn(),
  deletePendingRegistration: jest.fn(async () => undefined),
  deleteVerificationToken: jest.fn(async () => undefined),
  sendAccountCreatedEmail: jest.fn(async () => undefined),
  consumePasswordResetToken: jest.fn(async () => "awa.diop@example.test"),
  sendPasswordChangedEmail: jest.fn(async () => undefined),
  validatePasswordStrength: jest.fn(),
  localeFromHeaders: () => "fr",
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
};
const generateUniquePublicSlug = jest.fn(async () => "awa-diop");
const recordRegistrationConsents = jest.fn(async () => undefined);

jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
// Redis et le transport email sont des SINGLETONS ouverts au chargement du module : sans ces doubles, la
// suite passe mais Jest ne rend jamais la main (connexion laissée ouverte).
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn(), ttl: jest.fn(), keys: jest.fn(async () => []) } }));
jest.mock("@packages/email", () => ({ isEmailConfigured: () => false, sendTransactionalEmail: jest.fn(async () => ({ provider: "fake", providerMessageId: "x" })) }));
// Le module réel ouvre Redis et le transport email au chargement : on le remplace en entier (les
// fonctions non listées ne sont pas appelées par les deux chemins testés).
jest.mock("../utils/auth.helper", () => helpers);
jest.mock("../services/google-token.verifier", () => ({ buildGoogleTokenVerifier: () => null }));
jest.mock("../utils/slug.helper", () => ({ generateUniquePublicSlug }));
jest.mock("../utils/consent/consent.helper", () => ({ recordRegistrationConsents }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verifyRegistrationOtp, resetPassword } = require("./auth.controller") as typeof import("./auth.controller");

const MEMBRE = "64b00000000000000000aa01";
const EMAIL = "awa.diop@example.test";
const ANCIENNE = "$2a$10$empreinte.de.l.ancien.mot.de.passe.aaaaaaaaaaaaaaaaaaaaaa";

/** Prisma : « ce document existe déjà », sur le champ visé. */
const collision = (champ: string) => Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: [champ] } });

const EN_ATTENTE = {
  firstName: "Awa",
  lastName: "Diop",
  email: EMAIL,
  emailNormalized: EMAIL,
  passwordHash: ANCIENNE,
  termsVersion: "2026-01",
  privacyVersion: "2026-01",
  consentIp: "10.0.0.1",
  consentUserAgent: "jest",
  consentLocale: "fr",
  preferredLocale: "fr",
};

async function appeler(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, body: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await handler({ body, headers: {}, ip: "10.0.0.1" } as never, res as never, next as never);
  return { res, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
  prismaMock.user.create.mockResolvedValue({ id: MEMBRE });
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
  helpers.getPendingRegistration.mockResolvedValue(EN_ATTENTE);
  helpers.getEmailKeyFromToken.mockResolvedValue(EMAIL);
  generateUniquePublicSlug.mockResolvedValue("awa-diop");
});

describe("A195 — valider le code d'inscription", () => {
  it("le compte est créé une fois ; la seconde validation lit 409 EMAIL_ALREADY_USED, jamais un 500", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null); // les deux requêtes ont lu « email libre »
    prismaMock.user.create.mockRejectedValue(collision("emailNormalized"));

    const { error } = await appeler(verifyRegistrationOtp as never, { verificationToken: "t", otp: "123456" });

    expect(error).toMatchObject({ statusCode: 409, details: { code: "EMAIL_ALREADY_USED", field: "email" } });
    expect(helpers.sendAccountCreatedEmail).not.toHaveBeenCalled(); // un seul email de bienvenue : celui du gagnant
  });

  it("deux tirages de slug identiques : on retire, le compte est créé — ce n'est pas une réponse au membre", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockRejectedValueOnce(collision("publicSlug")).mockResolvedValue({ id: MEMBRE });

    const { res, error } = await appeler(verifyRegistrationOtp as never, { verificationToken: "t", otp: "123456" });

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(generateUniquePublicSlug).toHaveBeenCalledTimes(2); // second tirage
  });

  it("le chemin normal reste le chemin normal : 201, consentements journalisés, email envoyé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const { res, error } = await appeler(verifyRegistrationOtp as never, { verificationToken: "t", otp: "123456" });

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(recordRegistrationConsents).toHaveBeenCalledTimes(1);
    expect(helpers.sendAccountCreatedEmail).toHaveBeenCalledTimes(1);
  });
});

describe("A195 — réinitialiser le mot de passe", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: MEMBRE, firstName: "Awa", lastName: "Diop", emailNormalized: EMAIL, passwordHash: ANCIENNE });
  });

  it("l'écriture est conditionnée à l'empreinte LUE (celle sur laquelle le refus « même mot de passe » a porté)", async () => {
    const { res, error } = await appeler(resetPassword as never, { passwordResetToken: "t", newPassword: "Nouveau-Mot2Passe!" });

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: MEMBRE, passwordHash: ANCIENNE } }));
  });

  it("le mot de passe a changé entre-temps : 409, aucun écrasement silencieux, aucun email « mot de passe modifié »", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const { error } = await appeler(resetPassword as never, { passwordResetToken: "t", newPassword: "Nouveau-Mot2Passe!" });

    expect(error).toMatchObject({ statusCode: 409, details: { code: "PASSWORD_STATE_CHANGED" } });
    expect(helpers.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it("compte SANS mot de passe (connexion Google) : la condition vise null ET le champ absent (pitfall Mongo)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: MEMBRE, firstName: "Awa", lastName: "Diop", emailNormalized: EMAIL, passwordHash: null });

    await appeler(resetPassword as never, { passwordResetToken: "t", newPassword: "Nouveau-Mot2Passe!" });

    expect(prismaMock.user.updateMany.mock.calls[0][0].where).toEqual({ id: MEMBRE, OR: [{ passwordHash: null }, { passwordHash: { isSet: false } }] });
  });
});

// Fichier MODULE (et non script) : sans cela ses constantes de tête tomberaient dans la portee globale
// partagee par les specs, et se heurteraient a celles des autres fiches (TS2451 au typecheck du projet).
export {};
