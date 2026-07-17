import {
  SESSION_POLICY_DEFAULTS,
  loadSessionPolicy,
  inactivityWindowMs,
  absoluteLifetimeMs,
  remainingLifetimeMs,
  isAbsoluteExpired,
  computeSessionTtlSeconds,
  type SessionPolicyConfig,
} from "./session-policy";

/**
 * session-policy.spec.ts (D27 + DoD D30)
 * ======================================
 * Grave la politique de session : deux fenêtres (standard/rememberMe),
 * TTL = min(inactivité, vie absolue restante), frontières strictes.
 * Horloge et env injectés — aucun new Date(), aucun process.env.
 */

const NOW = Date.UTC(2026, 6, 20, 12, 0, 0); // 2026-07-20T12:00:00Z (ms)
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const CFG: SessionPolicyConfig = { ...SESSION_POLICY_DEFAULTS };

describe("loadSessionPolicy — env injecté et défauts", () => {
  it("sans env : les 4 défauts (60 min / 7 j / 7 j / 30 j)", () => {
    expect(loadSessionPolicy({})).toEqual({
      standardInactivityMinutes: 60,
      standardLifetimeDays: 7,
      rememberInactivityDays: 7,
      rememberLifetimeDays: 30,
    });
  });

  it("env valide : les valeurs sont prises", () => {
    expect(
      loadSessionPolicy({
        SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
        SESSION_STANDARD_LIFETIME_DAYS: "3",
        SESSION_REMEMBER_INACTIVITY_DAYS: "14",
        SESSION_ABSOLUTE_LIFETIME_DAYS: "60",
      })
    ).toEqual({
      standardInactivityMinutes: 30,
      standardLifetimeDays: 3,
      rememberInactivityDays: 14,
      rememberLifetimeDays: 60,
    });
  });

  it.each([
    ["vide", ""],
    ["non numérique", "abc"],
    ["zéro", "0"],
    ["négatif", "-5"],
    ["décimal", "4.5"],
  ])("env invalide (%s) → défaut, jamais de crash ni de NaN", (_label, raw) => {
    const cfg = loadSessionPolicy({ SESSION_INACTIVITY_TIMEOUT_MINUTES: raw });
    expect(cfg.standardInactivityMinutes).toBe(60);
  });
});

describe("fenêtres par type de session", () => {
  it("standard : inactivité 60 min, vie absolue 7 j", () => {
    expect(inactivityWindowMs(false, CFG)).toBe(60 * MINUTE);
    expect(absoluteLifetimeMs(false, CFG)).toBe(7 * DAY);
  });

  it("rememberMe : inactivité 7 j, vie absolue 30 j (rememberMe garde son sens)", () => {
    expect(inactivityWindowMs(true, CFG)).toBe(7 * DAY);
    expect(absoluteLifetimeMs(true, CFG)).toBe(30 * DAY);
  });
});

describe("remainingLifetimeMs / isAbsoluteExpired (SES-02)", () => {
  it("session neuve : tout le plafond restant", () => {
    expect(remainingLifetimeMs(NOW, false, CFG, NOW)).toBe(7 * DAY);
  });

  it("à mi-vie : la moitié restante", () => {
    const createdAt = NOW - 3.5 * DAY;
    expect(remainingLifetimeMs(createdAt, false, CFG, NOW)).toBe(3.5 * DAY);
    expect(isAbsoluteExpired(createdAt, false, CFG, NOW)).toBe(false);
  });

  it("frontière : exactement au plafond → expiré (<= 0), jamais négatif", () => {
    const createdAt = NOW - 7 * DAY;
    expect(remainingLifetimeMs(createdAt, false, CFG, NOW)).toBe(0);
    expect(isAbsoluteExpired(createdAt, false, CFG, NOW)).toBe(true);
    expect(remainingLifetimeMs(NOW - 8 * DAY, false, CFG, NOW)).toBe(0);
  });

  it("rememberMe : plafond 30 j", () => {
    expect(isAbsoluteExpired(NOW - 29 * DAY, true, CFG, NOW)).toBe(false);
    expect(isAbsoluteExpired(NOW - 30 * DAY, true, CFG, NOW)).toBe(true);
  });
});

describe("computeSessionTtlSeconds — TTL = min(inactivité, restant)", () => {
  it("session standard neuve : l'inactivité domine (3600 s)", () => {
    expect(computeSessionTtlSeconds(NOW, false, CFG, NOW)).toBe(3600);
  });

  it("session standard en fin de vie : le restant domine (< 60 min)", () => {
    const createdAt = NOW - (7 * DAY - 10 * MINUTE); // reste 10 min de vie absolue
    expect(computeSessionTtlSeconds(createdAt, false, CFG, NOW)).toBe(600);
  });

  it("rememberMe neuve : inactivité 7 j domine sur 30 j restants", () => {
    expect(computeSessionTtlSeconds(NOW, true, CFG, NOW)).toBe(7 * DAY / 1000);
  });

  it("rememberMe à J-2 du plafond : le restant (2 j) domine sur l'inactivité (7 j)", () => {
    const createdAt = NOW - 28 * DAY;
    expect(computeSessionTtlSeconds(createdAt, true, CFG, NOW)).toBe(2 * DAY / 1000);
  });

  it("session absolument expirée : 0 — l'appelant DOIT refuser (Redis rejette EX 0)", () => {
    expect(computeSessionTtlSeconds(NOW - 7 * DAY, false, CFG, NOW)).toBe(0);
    expect(computeSessionTtlSeconds(NOW - 31 * DAY, true, CFG, NOW)).toBe(0);
  });

  it("arrondi supérieur : jamais un TTL tronqué à 0 pour une session encore vivante", () => {
    const createdAt = NOW - (7 * DAY - 500); // reste 500 ms
    expect(computeSessionTtlSeconds(createdAt, false, CFG, NOW)).toBe(1);
  });
});
