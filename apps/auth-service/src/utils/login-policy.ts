/**
 * login-policy.ts — barème des échecs de CONNEXION par mot de passe (pur, sans I/O)
 * ================================================================================
 * D78 (11/09/2026, suite d'ANO-WEB-19 / recette API §2) : la connexion par mot de passe
 * n'avait AUCUN verrou. On ajoute un **throttling par compte** — pas un OTP à chaque
 * connexion (ni Airbnb ni BlaBlaCar ne le font ; ce serait de la friction inutile), juste
 * un ralentissement progressif des ÉCHECS répétés, invisible pour qui tape son bon mot de
 * passe.
 *
 * Barème par paliers de 5 échecs cumulés (compteur 24 h, remis à zéro à la première
 * connexion réussie) :
 *
 *  - échecs 1 → 4  : pas de verrou
 *  - 5e échec      : verrou 1 min
 *  - échecs 6 → 9  : pas de verrou
 *  - 10e échec     : verrou 15 min + email d'alerte au titulaire
 *  - échecs 11 → 14: pas de verrou
 *  - 15e et plus   : verrou 1 h (chaque échec supplémentaire aussi)
 *
 * Choix : des verrous COURTS (max 1 h), jamais 24 h. Un verrou par compte est un vecteur de
 * déni de service (un tiers peut verrouiller la victime en tapant de faux mots de passe) ;
 * des verrous courts qui expirent seuls ralentissent massivement le brute-force (quelques
 * essais par minute) sans jamais bloquer durablement le vrai titulaire. Le compteur est
 * incrémenté pour TOUTE adresse (existante ou non) : le verrou est donc indistinguable et ne
 * révèle pas l'existence d'un compte (ANO-API-08 / 18).
 */

export const LOGIN_ATTEMPTS_PER_TIER = 5;
/** Durées de verrou par palier atteint (1er, 2e, 3e et au-delà), en secondes. */
export const LOGIN_TIER_LOCK_SECONDS = [60, 900, 3600] as const;
/** Palier (1-based) à partir duquel l'email d'alerte au titulaire est envoyé. */
export const LOGIN_SECURITY_ALERT_TIER = 2;

export type LoginFailurePolicy = {
  /** Durée du verrou déclenché par CET échec (0 = aucun). */
  lockSeconds: number;
  /** Envoyer l'email « tentatives de connexion » au titulaire (si le compte existe). */
  securityAlert: boolean;
  /** Essais restants avant le prochain palier (0 quand cet échec EST un palier). */
  attemptsLeft: number;
};

/** Politique à appliquer pour le N-ième échec de connexion cumulé (N ≥ 1). */
export function getLoginFailurePolicy(attemptNumber: number): LoginFailurePolicy {
  const n = Math.max(1, Math.floor(attemptNumber));
  const maxTier = LOGIN_TIER_LOCK_SECONDS.length;
  const tierIndex = Math.floor(n / LOGIN_ATTEMPTS_PER_TIER); // 0 avant le 1er palier

  // Au-delà du dernier palier : chaque échec supplémentaire re-verrouille à la durée max.
  if (tierIndex >= maxTier) {
    return { lockSeconds: LOGIN_TIER_LOCK_SECONDS[maxTier - 1], securityAlert: true, attemptsLeft: 0 };
  }

  const isTierHit = n % LOGIN_ATTEMPTS_PER_TIER === 0;
  if (isTierHit) {
    return {
      lockSeconds: LOGIN_TIER_LOCK_SECONDS[tierIndex - 1],
      securityAlert: tierIndex >= LOGIN_SECURITY_ALERT_TIER,
      attemptsLeft: 0,
    };
  }

  return { lockSeconds: 0, securityAlert: false, attemptsLeft: LOGIN_ATTEMPTS_PER_TIER - (n % LOGIN_ATTEMPTS_PER_TIER) };
}
