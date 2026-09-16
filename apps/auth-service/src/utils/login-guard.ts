/**
 * login-guard.ts — throttling des ÉCHECS de connexion par mot de passe (D78)
 * =========================================================================
 * Redis autour du barème pur `login-policy.ts`. Le compteur est indexé par adresse normalisée
 * (existante ou non) : le verrou ne révèle donc jamais l'existence d'un compte. Verrous courts
 * (max 1 h) qui expirent seuls — jamais de blocage durable (voir login-policy pour le pourquoi).
 */
import redis from "@packages/libs/redis";
import { RateLimitError } from "@packages/error-handler";
import { getLoginFailurePolicy } from "./login-policy";

const LOGIN_FAILED_COUNTER_TTL = 86_400; // 24 h

const keys = {
  lock: (emailKey: string) => `login_lock:${emailKey}`,
  attempts: (emailKey: string) => `login_attempts:${emailKey}`,
  alerted: (emailKey: string) => `login_alerted:${emailKey}`,
};

/** Verrou actif ? → 429 indistinguable (même corps pour une adresse existante ou non). */
export async function assertLoginNotLocked(emailKey: string): Promise<void> {
  const ttl = await redis.ttl(keys.lock(emailKey));
  if (ttl > 0) {
    throw new RateLimitError("Too many attempts. Please try again later.", {
      type: "login",
      code: "TOO_MANY_ATTEMPTS",
      lockUntilSeconds: ttl,
    });
  }
}

export type LoginFailureOutcome = { locked: boolean; lockSeconds: number; shouldAlert: boolean; attemptCount: number };

/** Enregistre un échec, applique le palier, et dit s'il faut verrouiller / alerter le titulaire. */
export async function registerLoginFailure(emailKey: string): Promise<LoginFailureOutcome> {
  const attemptsKey = keys.attempts(emailKey);
  const previous = Number.parseInt((await redis.get(attemptsKey)) || "0", 10);
  const attemptCount = previous + 1;
  await redis.set(attemptsKey, String(attemptCount), "EX", LOGIN_FAILED_COUNTER_TTL);

  const policy = getLoginFailurePolicy(attemptCount);
  if (policy.lockSeconds > 0) {
    await redis.set(keys.lock(emailKey), "locked", "EX", policy.lockSeconds);
  }

  let shouldAlert = false;
  if (policy.securityAlert) {
    // Une seule alerte par salve d'échecs (NX) : on ne spamme pas le titulaire.
    const set = await redis.set(keys.alerted(emailKey), "1", "EX", LOGIN_FAILED_COUNTER_TTL, "NX");
    shouldAlert = set === "OK";
  }

  return { locked: policy.lockSeconds > 0, lockSeconds: policy.lockSeconds, shouldAlert, attemptCount };
}

/** Succès : on efface le compteur, le verrou et le drapeau d'alerte. */
export async function clearLoginFailures(emailKey: string): Promise<void> {
  await redis.del(keys.attempts(emailKey), keys.lock(emailKey), keys.alerted(emailKey));
}
