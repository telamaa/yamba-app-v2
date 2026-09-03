import {
  getOtpFailurePolicy,
  OTP_ATTEMPTS_PER_TIER,
  OTP_TIER_LOCK_SECONDS,
  formatLockDuration,
} from "./otp-policy";

describe("otp-policy — barème par paliers (RG-A-01)", () => {
  it("échecs 1 à 4 : pas de verrou, essais restants décroissants, code conservé", () => {
    expect(getOtpFailurePolicy(1)).toEqual({
      lockSeconds: 0, invalidateOtp: false, securityAlert: false, attemptsLeft: 4,
    });
    expect(getOtpFailurePolicy(4).attemptsLeft).toBe(1);
    expect(getOtpFailurePolicy(4).lockSeconds).toBe(0);
  });

  it("5e échec : code invalidé + 1 min, sans alerte", () => {
    expect(getOtpFailurePolicy(5)).toEqual({
      lockSeconds: 60, invalidateOtp: true, securityAlert: false, attemptsLeft: 0,
    });
  });

  it("échecs 6 à 9 : nouveau cycle de 5 sur le code renvoyé", () => {
    expect(getOtpFailurePolicy(6).attemptsLeft).toBe(4);
    expect(getOtpFailurePolicy(9).attemptsLeft).toBe(1);
    expect(getOtpFailurePolicy(9).invalidateOtp).toBe(false);
  });

  it("10e échec : code invalidé + 30 min + alerte sécurité", () => {
    expect(getOtpFailurePolicy(10)).toEqual({
      lockSeconds: 1800, invalidateOtp: true, securityAlert: true, attemptsLeft: 0,
    });
  });

  it("15e échec et chaque échec suivant : 24 h", () => {
    expect(getOtpFailurePolicy(15).lockSeconds).toBe(86400);
    expect(getOtpFailurePolicy(16).lockSeconds).toBe(86400);
    expect(getOtpFailurePolicy(16).invalidateOtp).toBe(true);
    expect(getOtpFailurePolicy(40).lockSeconds).toBe(86400);
  });

  it("jamais de blocage 24 h avant le 15e échec (décision recette 03/09)", () => {
    for (let n = 1; n < 15; n += 1) {
      expect(getOtpFailurePolicy(n).lockSeconds).toBeLessThan(86400);
    }
  });

  it("constantes cohérentes avec la doc", () => {
    expect(OTP_ATTEMPTS_PER_TIER).toBe(5);
    expect(OTP_TIER_LOCK_SECONDS).toEqual([60, 1800, 86400]);
  });

  it("formatLockDuration : secondes / minutes / heures arrondies au supérieur", () => {
    expect(formatLockDuration(45)).toBe("45 second(s)");
    expect(formatLockDuration(61)).toBe("2 minute(s)");
    expect(formatLockDuration(1800)).toBe("30 minute(s)");
    expect(formatLockDuration(86400)).toBe("24 hour(s)");
  });
});
