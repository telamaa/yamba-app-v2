import { ADMIN_SESSION_DEFAULTS, adminSessionTtlSeconds, loadAdminSessionPolicy } from "./admin-session-policy";

const MIN = 60_000;
const H = 60 * MIN;

describe("admin-session-policy (D54, 8A)", () => {
  const policy = ADMIN_SESSION_DEFAULTS;

  it("TTL = fenêtre d'inactivité (45 min) tant que la vie absolue est loin", () => {
    const t0 = 1_700_000_000_000;
    expect(adminSessionTtlSeconds(t0, policy, t0)).toBe(45 * 60);
    expect(adminSessionTtlSeconds(t0, policy, t0 + 3 * H)).toBe(45 * 60);
  });

  it("TTL = vie absolue restante quand elle est plus courte que l'inactivité", () => {
    const t0 = 1_700_000_000_000;
    expect(adminSessionTtlSeconds(t0, policy, t0 + 12 * H - 10 * MIN)).toBe(10 * 60);
  });

  it("session absolument expirée → 0 (l'appelant refuse)", () => {
    const t0 = 1_700_000_000_000;
    expect(adminSessionTtlSeconds(t0, policy, t0 + 12 * H)).toBe(0);
    expect(adminSessionTtlSeconds(t0, policy, t0 + 13 * H)).toBe(0);
  });

  it("loadAdminSessionPolicy : env valide appliqué, env invalide → défauts", () => {
    expect(loadAdminSessionPolicy({ ADMIN_SESSION_INACTIVITY_MINUTES: "20", ADMIN_SESSION_LIFETIME_HOURS: "8" })).toEqual({
      inactivityMinutes: 20,
      lifetimeHours: 8,
      preauthMinutes: 5,
    });
    expect(loadAdminSessionPolicy({ ADMIN_SESSION_INACTIVITY_MINUTES: "abc", ADMIN_SESSION_LIFETIME_HOURS: "-1" })).toEqual(ADMIN_SESSION_DEFAULTS);
  });
});
