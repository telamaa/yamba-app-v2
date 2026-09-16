import { googleSignIn, type GoogleAuthDeps, type GoogleProfile } from "./google-auth.service";

const PROFILE: GoogleProfile = {
  sub: "g-123",
  email: "Awa.Diop@gmail.com",
  emailVerified: true,
  firstName: "Awa",
  lastName: "Diop",
  avatarUrl: "https://lh3.googleusercontent.com/a",
};
const USER = { id: "u1", email: "Awa.Diop@gmail.com", firstName: "Awa", lastName: "Diop", roles: ["SHIPPER"] };

function deps(overrides: Partial<GoogleAuthDeps> = {}): GoogleAuthDeps & { calls: Record<string, jest.Mock> } {
  const calls = {
    identityFind: jest.fn().mockResolvedValue(null),
    identityUpdate: jest.fn().mockResolvedValue({ count: 1 }),
    identityCreate: jest.fn().mockResolvedValue({}),
    userFind: jest.fn().mockResolvedValue(null),
    userCreate: jest.fn().mockResolvedValue({ ...USER, id: "new" }),
    recordConsents: jest.fn().mockResolvedValue(undefined),
  };
  const tx = { user: { create: calls.userCreate } } as unknown as Parameters<GoogleAuthDeps["recordConsents"]>[0];
  return {
    calls,
    verify: async () => PROFILE,
    prisma: {
      authIdentity: { findUnique: calls.identityFind, updateMany: calls.identityUpdate, create: calls.identityCreate },
      user: { findUnique: calls.userFind },
      $transaction: async (fn) => fn(tx),
    },
    generatePublicSlug: async () => "awa-diop",
    recordConsents: calls.recordConsents,
    normalizeEmail: (e) => e.trim().toLowerCase(),
    ...overrides,
  };
}

describe("googleSignIn (D47)", () => {
  it("serveur non configuré → 503 GOOGLE_NOT_CONFIGURED", async () => {
    await expect(googleSignIn(deps({ verify: null }), { idToken: "x" })).rejects.toMatchObject({
      statusCode: 503, details: { type: "oauth", code: "GOOGLE_NOT_CONFIGURED" },
    });
  });

  it("jeton invalide → 401 ; email non vérifié → 403", async () => {
    await expect(googleSignIn(deps({ verify: async () => null }), { idToken: "x" })).rejects.toMatchObject({
      statusCode: 401, details: { code: "GOOGLE_TOKEN_INVALID" },
    });
    await expect(
      googleSignIn(deps({ verify: async () => ({ ...PROFILE, emailVerified: false }) }), { idToken: "x" })
    ).rejects.toMatchObject({ statusCode: 403, details: { code: "GOOGLE_EMAIL_UNVERIFIED" } });
  });

  it("identité connue → connexion, lastUsedAt mis à jour, aucun compte créé", async () => {
    const d = deps();
    d.calls.identityFind.mockResolvedValue({ userId: "u1" });
    d.calls.userFind.mockResolvedValue(USER);
    const r = await googleSignIn(d, { idToken: "x" });
    expect(r).toEqual({ status: "LOGGED_IN", user: USER, created: false, linked: false });
    expect(d.calls.identityUpdate).toHaveBeenCalled();
    expect(d.calls.userCreate).not.toHaveBeenCalled();
  });

  it("compte existant avec le même email (normalisé) → identité rattachée, connexion", async () => {
    const d = deps();
    d.calls.userFind.mockImplementation(async (args: { where: { emailNormalized?: string } }) =>
      args.where.emailNormalized === "awa.diop@gmail.com" ? USER : null
    );
    const r = await googleSignIn(d, { idToken: "x" });
    expect(r).toMatchObject({ status: "LOGGED_IN", linked: true, created: false });
    expect(d.calls.identityCreate.mock.calls[0][0].data).toMatchObject({ userId: "u1", provider: "GOOGLE", providerSub: "g-123" });
  });

  it("nouveau compte sans consentement → CONSENT_REQUIRED avec profil, RIEN n'est créé", async () => {
    const d = deps();
    const r = await googleSignIn(d, { idToken: "x" });
    expect(r).toEqual({
      status: "CONSENT_REQUIRED",
      profile: { email: PROFILE.email, firstName: "Awa", lastName: "Diop", avatarUrl: PROFILE.avatarUrl },
    });
    expect(d.calls.userCreate).not.toHaveBeenCalled();
    expect(d.calls.identityCreate).not.toHaveBeenCalled();
  });

  it("nouveau compte avec consentement → User (sans mot de passe) + identité + ConsentLog dans la transaction", async () => {
    const d = deps();
    const r = await googleSignIn(d, {
      idToken: "x",
      consent: { termsVersion: "2026-04-26", privacyVersion: "2026-04-26" },
      locale: "en-US",
      ip: "10.0.0.1",
      userAgent: "Safari",
    });
    expect(r).toMatchObject({ status: "LOGGED_IN", created: true });
    const data = d.calls.userCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      emailNormalized: "awa.diop@gmail.com",
      passwordHash: null,
      publicSlug: "awa-diop",
      preferredLocale: "en",
      identities: { create: { provider: "GOOGLE", providerSub: "g-123" } },
    });
    expect(d.calls.recordConsents).toHaveBeenCalledWith(expect.anything(), "new", {
      termsVersion: "2026-04-26", privacyVersion: "2026-04-26", ipAddress: "10.0.0.1", userAgent: "Safari", locale: "en",
    });
  });
});

/**
 * A195 — deux connexions Google à la même seconde (passe concurrence MEMBRE, suite d'A192)
 * =========================================================================================
 * Ce service lit trois fois « est-ce que ça existe ? » puis écrit. Une lecture d'unicité ne RÉSERVE rien :
 * entre le « non » et l'écriture, l'autre onglet est passé. Les deux collisions possibles portent chacune
 * une réponse ÉVIDENTE — l'identité que l'autre vient d'écrire est exactement celle qu'on voulait, le compte
 * qu'il vient de créer est celui du même membre —, donc un 500 n'a jamais été la bonne réponse.
 */
describe("A195 — connexions Google simultanées", () => {
  const collision = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  it("rattachement joué deux fois : la collision est une non-nouvelle, le membre est connecté", async () => {
    const d = deps();
    d.calls.userFind.mockImplementation(async (args: { where: { emailNormalized?: string } }) =>
      args.where.emailNormalized === "awa.diop@gmail.com" ? USER : null
    );
    d.calls.identityCreate.mockRejectedValue(collision()); // l'autre onglet a rattaché en premier

    const r = await googleSignIn(d, { idToken: "x" });

    expect(r).toMatchObject({ status: "LOGGED_IN", user: USER, linked: true, created: false });
  });

  it("deux créations de compte : la perdante se rattache au compte de la gagnante, jamais un 500", async () => {
    const d = deps();
    let compteCree = false;
    d.calls.userFind.mockImplementation(async (args: { where: { emailNormalized?: string } }) =>
      args.where.emailNormalized && compteCree ? USER : null // « libre » à la lecture, pris à la relecture
    );
    d.calls.userCreate.mockImplementation(async () => {
      compteCree = true;
      throw collision();
    });

    const r = await googleSignIn(d, { idToken: "x", consent: { termsVersion: "2026-01", privacyVersion: "2026-01" } });

    expect(r).toMatchObject({ status: "LOGGED_IN", user: USER, linked: true, created: false });
    expect(d.calls.recordConsents).not.toHaveBeenCalled(); // les consentements de la gagnante suffisent
  });

  it("collision sur autre chose que l'email (aucun compte à relire) : l'erreur remonte, on n'invente rien", async () => {
    const d = deps();
    d.calls.userCreate.mockRejectedValue(collision()); // et userFind rend toujours null

    await expect(
      googleSignIn(d, { idToken: "x", consent: { termsVersion: "2026-01", privacyVersion: "2026-01" } })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
