/**
 * session-policy.ts (D27 — SES-01 / SES-02)
 * =========================================
 * Logique PURE de la politique de session. Zéro dépendance (ni Redis,
 * ni Express) → testable unitairement (D30), horloge injectable.
 *
 * Deux fenêtres par type de session (décision session feat/session-policy) :
 * - standard   : inactivité 60 min · vie absolue 7 jours
 * - rememberMe : inactivité 7 jours · vie absolue 30 jours
 *
 * L'astuce centrale : TTL Redis = min(fenêtre d'inactivité, vie absolue
 * restante depuis createdAt). L'expiration Redis EST le timeout
 * d'inactivité, et la rotation ne peut jamais repousser la session
 * au-delà du plafond absolu puisque le TTL est recalculé depuis le
 * createdAt transporté de rotation en rotation.
 */

export type SessionPolicyConfig = {
  standardInactivityMinutes: number;
  standardLifetimeDays: number;
  rememberInactivityDays: number;
  rememberLifetimeDays: number;
};

export const SESSION_POLICY_DEFAULTS: SessionPolicyConfig = {
  standardInactivityMinutes: 60,
  standardLifetimeDays: 7,
  rememberInactivityDays: 7,
  rememberLifetimeDays: 30,
};

/** Parse un entier strictement positif, sinon retombe sur le défaut. */
function positiveIntOr(fallback: number, raw: string | undefined): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Charge la config depuis un env injecté (testable).
 * Variables : SESSION_INACTIVITY_TIMEOUT_MINUTES ·
 * SESSION_STANDARD_LIFETIME_DAYS · SESSION_REMEMBER_INACTIVITY_DAYS ·
 * SESSION_ABSOLUTE_LIFETIME_DAYS.
 */
export function loadSessionPolicy(
  env: Record<string, string | undefined> = process.env
): SessionPolicyConfig {
  return {
    standardInactivityMinutes: positiveIntOr(
      SESSION_POLICY_DEFAULTS.standardInactivityMinutes,
      env.SESSION_INACTIVITY_TIMEOUT_MINUTES
    ),
    standardLifetimeDays: positiveIntOr(
      SESSION_POLICY_DEFAULTS.standardLifetimeDays,
      env.SESSION_STANDARD_LIFETIME_DAYS
    ),
    rememberInactivityDays: positiveIntOr(
      SESSION_POLICY_DEFAULTS.rememberInactivityDays,
      env.SESSION_REMEMBER_INACTIVITY_DAYS
    ),
    rememberLifetimeDays: positiveIntOr(
      SESSION_POLICY_DEFAULTS.rememberLifetimeDays,
      env.SESSION_ABSOLUTE_LIFETIME_DAYS
    ),
  };
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Fenêtre d'inactivité (ms) selon le type de session. */
export function inactivityWindowMs(
  rememberMe: boolean,
  config: SessionPolicyConfig
): number {
  return rememberMe
    ? config.rememberInactivityDays * DAY_MS
    : config.standardInactivityMinutes * MINUTE_MS;
}

/** Vie absolue totale (ms) selon le type de session (SES-02). */
export function absoluteLifetimeMs(
  rememberMe: boolean,
  config: SessionPolicyConfig
): number {
  return rememberMe
    ? config.rememberLifetimeDays * DAY_MS
    : config.standardLifetimeDays * DAY_MS;
}

/** Vie absolue RESTANTE (ms) depuis la création — jamais négative. */
export function remainingLifetimeMs(
  createdAtMs: number,
  rememberMe: boolean,
  config: SessionPolicyConfig,
  nowMs: number
): number {
  const end = createdAtMs + absoluteLifetimeMs(rememberMe, config);
  return Math.max(0, end - nowMs);
}

/** SES-02 — le plafond absolu est-il dépassé ? (frontière : à l'instant exact, expiré) */
export function isAbsoluteExpired(
  createdAtMs: number,
  rememberMe: boolean,
  config: SessionPolicyConfig,
  nowMs: number
): boolean {
  return remainingLifetimeMs(createdAtMs, rememberMe, config, nowMs) <= 0;
}

/**
 * TTL Redis (secondes) à poser sur la clé de session :
 * min(inactivité, vie absolue restante), arrondi supérieur.
 * Retourne 0 si la session est déjà absolument expirée — l'appelant
 * DOIT alors refuser (Redis rejette EX 0).
 */
export function computeSessionTtlSeconds(
  createdAtMs: number,
  rememberMe: boolean,
  config: SessionPolicyConfig,
  nowMs: number
): number {
  const remaining = remainingLifetimeMs(createdAtMs, rememberMe, config, nowMs);
  if (remaining <= 0) return 0;
  const ttlMs = Math.min(inactivityWindowMs(rememberMe, config), remaining);
  return Math.ceil(ttlMs / 1000);
}
