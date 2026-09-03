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
    identityUpdate: jest.fn().mockResolvedValue({}),
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
      authIdentity: { findUnique: calls.identityFind, update: calls.identityUpdate, create: calls.identityCreate },
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
