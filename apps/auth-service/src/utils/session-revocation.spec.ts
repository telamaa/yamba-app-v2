/** session-revocation.spec.ts — la révocation de session est immédiate (ANO-API-07). */
import { isSessionRevoked, sessionKey } from "@packages/middleware/session-revocation";

describe("sessionKey", () => {
  it("est exactement la clé posée par auth-service (une divergence rendrait la garde inerte)", () => {
    expect(sessionKey("u1", "j1")).toBe("refresh_jti:u1:j1");
  });
});

describe("isSessionRevoked (ANO-API-07)", () => {
  it("session encore en Redis → acceptée", () => {
    expect(isSessionRevoked("j1", 1)).toBe(false);
  });

  it("session absente → RÉVOQUÉE : l'accès tombe sans attendre l'expiration du jeton", () => {
    expect(isSessionRevoked("j1", 0)).toBe(true);
  });

  it("jeton SANS jti (émis avant la correction) → accepté, il expire de lui-même", () => {
    expect(isSessionRevoked(undefined, 0)).toBe(false);
    expect(isSessionRevoked(null, 0)).toBe(false);
    expect(isSessionRevoked("", 0)).toBe(false);
  });

  it("Redis injoignable → on laisse passer : une panne de cache ne déconnecte pas la plateforme", () => {
    expect(isSessionRevoked("j1", null)).toBe(false);
  });
});
