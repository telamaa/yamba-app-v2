/**
 * admin-session-policy.ts — durées d'une session ADMIN (D54, 8A)
 * ===============================================================
 * Logique PURE, horloge injectable (même patron que session-policy.ts).
 * Une session admin est COURTE et n'a pas de « rester connecté » :
 * - inactivité : 45 min (ADMIN_SESSION_INACTIVITY_MINUTES)
 * - vie absolue : 12 h (ADMIN_SESSION_LIFETIME_HOURS)
 * - pré-authentification (entre mot de passe et TOTP) : 5 min
 * TTL Redis = min(inactivité, vie absolue restante) — l'expiration Redis
 * EST le timeout d'inactivité, la rotation ne repousse jamais le plafond.
 */

export type AdminSessionPolicy = {
  inactivityMinutes: number;
  lifetimeHours: number;
  preauthMinutes: number;
};

export const ADMIN_SESSION_DEFAULTS: AdminSessionPolicy = {
  inactivityMinutes: 45,
  lifetimeHours: 12,
  preauthMinutes: 5,
};

function positiveIntOr(fallback: number, raw: string | undefined): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function loadAdminSessionPolicy(env: Record<string, string | undefined> = process.env): AdminSessionPolicy {
  return {
    inactivityMinutes: positiveIntOr(ADMIN_SESSION_DEFAULTS.inactivityMinutes, env.ADMIN_SESSION_INACTIVITY_MINUTES),
    lifetimeHours: positiveIntOr(ADMIN_SESSION_DEFAULTS.lifetimeHours, env.ADMIN_SESSION_LIFETIME_HOURS),
    preauthMinutes: positiveIntOr(ADMIN_SESSION_DEFAULTS.preauthMinutes, env.ADMIN_PREAUTH_MINUTES),
  };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Vie absolue restante (ms) depuis createdAt ; 0 si dépassée. */
export function adminRemainingLifetimeMs(createdAt: number, policy: AdminSessionPolicy, now: number): number {
  return Math.max(0, createdAt + policy.lifetimeHours * HOUR_MS - now);
}

/** TTL (s) à poser sur le record : min(inactivité, vie restante) ; 0 = refuser. */
export function adminSessionTtlSeconds(createdAt: number, policy: AdminSessionPolicy, now: number): number {
  const remaining = adminRemainingLifetimeMs(createdAt, policy, now);
  if (remaining <= 0) return 0;
  return Math.ceil(Math.min(policy.inactivityMinutes * MINUTE_MS, remaining) / 1000);
}
