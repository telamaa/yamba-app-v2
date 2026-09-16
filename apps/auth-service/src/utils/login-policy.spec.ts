import {
  getLoginFailurePolicy,
  LOGIN_ATTEMPTS_PER_TIER,
  LOGIN_TIER_LOCK_SECONDS,
} from "./login-policy";

describe("getLoginFailurePolicy — barème d'échecs de connexion (D78)", () => {
  it("les 4 premiers échecs ne verrouillent pas", () => {
    for (let n = 1; n <= 4; n++) {
      const p = getLoginFailurePolicy(n);
      expect(p.lockSeconds).toBe(0);
      expect(p.securityAlert).toBe(false);
      expect(p.attemptsLeft).toBe(LOGIN_ATTEMPTS_PER_TIER - n);
    }
  });

  it("le 5e échec verrouille 1 min, sans alerte (1er palier)", () => {
    const p = getLoginFailurePolicy(5);
    expect(p.lockSeconds).toBe(LOGIN_TIER_LOCK_SECONDS[0]);
    expect(p.securityAlert).toBe(false);
    expect(p.attemptsLeft).toBe(0);
  });

  it("le 10e échec verrouille 15 min ET envoie l'alerte (2e palier)", () => {
    const p = getLoginFailurePolicy(10);
    expect(p.lockSeconds).toBe(LOGIN_TIER_LOCK_SECONDS[1]);
    expect(p.securityAlert).toBe(true);
    expect(p.attemptsLeft).toBe(0);
  });

  it("le 15e échec verrouille 1 h avec alerte (3e palier)", () => {
    const p = getLoginFailurePolicy(15);
    expect(p.lockSeconds).toBe(LOGIN_TIER_LOCK_SECONDS[2]);
    expect(p.securityAlert).toBe(true);
  });

  it("au-delà du dernier palier, chaque échec re-verrouille à la durée max", () => {
    for (const n of [16, 20, 37, 100]) {
      const p = getLoginFailurePolicy(n);
      expect(p.lockSeconds).toBe(LOGIN_TIER_LOCK_SECONDS[LOGIN_TIER_LOCK_SECONDS.length - 1]);
      expect(p.securityAlert).toBe(true);
    }
  });

  it("les échecs entre deux paliers annoncent les essais restants sans verrou", () => {
    expect(getLoginFailurePolicy(6)).toMatchObject({ lockSeconds: 0, attemptsLeft: 4 });
    expect(getLoginFailurePolicy(9)).toMatchObject({ lockSeconds: 0, attemptsLeft: 1 });
    expect(getLoginFailurePolicy(11)).toMatchObject({ lockSeconds: 0, attemptsLeft: 4 });
  });

  it("borne les entrées non entières / < 1 au 1er échec", () => {
    expect(getLoginFailurePolicy(0).attemptsLeft).toBe(LOGIN_ATTEMPTS_PER_TIER - 1);
    expect(getLoginFailurePolicy(-3).lockSeconds).toBe(0);
    expect(getLoginFailurePolicy(5.9).lockSeconds).toBe(LOGIN_TIER_LOCK_SECONDS[0]);
  });
});
