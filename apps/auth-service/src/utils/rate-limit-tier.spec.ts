/** rate-limit-tier.spec.ts — le plafond du limiteur du gateway (A147). */
import { RATE_LIMIT_ANONYMOUS, RATE_LIMIT_AUTHENTICATED, extractSessionToken, rateLimitMax, resolveRateLimits } from "@packages/middleware/rate-limit-tier";

const always = () => true;
const never = () => false;

describe("extractSessionToken (A147)", () => {
  it("cookie membre, puis cookie admin, puis Bearer ; rien sinon", () => {
    expect(extractSessionToken({ cookies: { access_token: "m" } })).toBe("m");
    expect(extractSessionToken({ cookies: { admin_access_token: "a" } })).toBe("a");
    expect(extractSessionToken({ cookies: { access_token: "m", admin_access_token: "a" } })).toBe("m");
    expect(extractSessionToken({ headers: { authorization: "Bearer b" } })).toBe("b");
    expect(extractSessionToken({})).toBeNull();
    expect(extractSessionToken({ cookies: { access_token: "" }, headers: { authorization: "Basic x" } })).toBeNull();
  });
});

describe("rateLimitMax (A147)", () => {
  it("sans jeton → plafond anonyme ; jeton valide → plafond connecté", () => {
    expect(rateLimitMax({}, always)).toBe(RATE_LIMIT_ANONYMOUS);
    expect(rateLimitMax({ cookies: { access_token: "t" } }, always)).toBe(RATE_LIMIT_AUTHENTICATED);
  });
  it("un jeton forgé ou expiré ne donne RIEN de plus qu'un anonyme (la signature est vérifiée)", () => {
    expect(rateLimitMax({ cookies: { access_token: "forgé" } }, never)).toBe(RATE_LIMIT_ANONYMOUS);
    expect(rateLimitMax({ headers: { authorization: "Bearer expiré" } }, never)).toBe(RATE_LIMIT_ANONYMOUS);
  });
  it("les deux plafonds sont distincts et le connecté est le plus haut", () => {
    expect(RATE_LIMIT_AUTHENTICATED).toBeGreaterThan(RATE_LIMIT_ANONYMOUS);
  });
});

describe("resolveRateLimits (recette 09/09/2026)", () => {
  it("sans variable → les défauts", () => {
    expect(resolveRateLimits({})).toEqual({ anonymous: RATE_LIMIT_ANONYMOUS, authenticated: RATE_LIMIT_AUTHENTICATED });
  });
  it("une valeur entière strictement positive surcharge, chacune indépendamment", () => {
    expect(resolveRateLimits({ RATE_LIMIT_ANONYMOUS_MAX: "2000" })).toEqual({ anonymous: 2000, authenticated: RATE_LIMIT_AUTHENTICATED });
    expect(resolveRateLimits({ RATE_LIMIT_AUTHENTICATED_MAX: " 5000 " })).toEqual({ anonymous: RATE_LIMIT_ANONYMOUS, authenticated: 5000 });
  });
  it("vide, zéro, négatif ou non numérique → ignoré (jamais un plafond nul)", () => {
    for (const v of ["", "0", "-5", "abc", "1e3", "12.5"]) {
      expect(resolveRateLimits({ RATE_LIMIT_ANONYMOUS_MAX: v })).toEqual({ anonymous: RATE_LIMIT_ANONYMOUS, authenticated: RATE_LIMIT_AUTHENTICATED });
    }
  });
  it("les plafonds résolus sont ceux que rateLimitMax applique", () => {
    const limits = resolveRateLimits({ RATE_LIMIT_ANONYMOUS_MAX: "7", RATE_LIMIT_AUTHENTICATED_MAX: "9" });
    expect(rateLimitMax({}, always, limits)).toBe(7);
    expect(rateLimitMax({ cookies: { access_token: "t" } }, always, limits)).toBe(9);
    expect(rateLimitMax({ cookies: { access_token: "forgé" } }, never, limits)).toBe(7);
  });
});
