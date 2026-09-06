/** rate-limit-tier.spec.ts — le plafond du limiteur du gateway (A147). */
import { RATE_LIMIT_ANONYMOUS, RATE_LIMIT_AUTHENTICATED, extractSessionToken, rateLimitMax } from "@packages/middleware/rate-limit-tier";

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
