/**
 * otp-policy.ts — barème des échecs de saisie d'un code OTP (pur, sans I/O)
 * =======================================================================
 * Décision de recette du 03/09/2026 (RG-A-01, DOC-METIER) : l'ancien barème
 * verrouillait 24 h dès le 6e échec — trop dur pour une faute de frappe sur
 * un code à 6 chiffres. Le nouveau barème est par PALIERS de 5 échecs
 * cumulés (compteur 24 h, jamais remis à zéro par un renvoi — sécurité) :
 *
 *  - échecs 1 → 4  : pas de verrou, on annonce le nombre d'essais restants
 *  - 5e échec      : le code est INVALIDÉ (il faut en redemander un) + 1 min
 *  - échecs 6 → 9  : pas de verrou, essais restants avant le palier suivant
 *  - 10e échec     : code invalidé + 30 min + email d'alerte sécurité
 *  - échecs 11 → 14: pas de verrou, essais restants
 *  - 15e et plus   : code invalidé + 24 h (chaque échec supplémentaire aussi)
 *
 * Invalider le code à chaque palier rend le brute-force inutile : un
 * attaquant n'a jamais plus de 5 essais sur un même code, et le vrai
 * utilisateur, lui, redemande simplement un code après 1 minute.
 */

export const OTP_ATTEMPTS_PER_TIER = 5;
export const OTP_TIER_LOCK_SECONDS = [60, 1800, 86400] as const;
/** Palier (1-based) à partir duquel l'email d'alerte sécurité est envoyé. */
export const OTP_SECURITY_ALERT_TIER = 2;

export type OtpFailurePolicy = {
  /** Durée du verrou déclenché par CET échec (0 = aucun). */
  lockSeconds: number;
  /** Le code courant doit être supprimé (l'utilisateur devra en redemander un). */
  invalidateOtp: boolean;
  /** Envoyer l'email « activité suspecte » (une fois par session d'échecs). */
  securityAlert: boolean;
  /** Essais restants avant le prochain palier (0 quand cet échec EST un palier). */
  attemptsLeft: number;
};

/**
 * Politique à appliquer pour le N-ième échec cumulé (N ≥ 1).
 */
export function getOtpFailurePolicy(attemptNumber: number): OtpFailurePolicy {
  const n = Math.max(1, Math.floor(attemptNumber));
  const maxTier = OTP_TIER_LOCK_SECONDS.length;
  const tierIndex = Math.floor(n / OTP_ATTEMPTS_PER_TIER); // 0 avant le 1er palier

  // Au-delà du dernier palier : chaque échec supplémentaire re-verrouille 24 h.
  if (tierIndex >= maxTier) {
    return {
      lockSeconds: OTP_TIER_LOCK_SECONDS[maxTier - 1],
      invalidateOtp: true,
      securityAlert: true,
      attemptsLeft: 0,
    };
  }

  const isTierHit = n % OTP_ATTEMPTS_PER_TIER === 0;
  if (isTierHit) {
    return {
      lockSeconds: OTP_TIER_LOCK_SECONDS[tierIndex - 1],
      invalidateOtp: true,
      securityAlert: tierIndex >= OTP_SECURITY_ALERT_TIER,
      attemptsLeft: 0,
    };
  }

  return {
    lockSeconds: 0,
    invalidateOtp: false,
    securityAlert: false,
    attemptsLeft: OTP_ATTEMPTS_PER_TIER - (n % OTP_ATTEMPTS_PER_TIER),
  };
}

/**
 * Formatte une durée en secondes pour un message d'API (anglais — surface
 * publique). Le front traduit à partir de `lockUntilSeconds`, jamais du texte.
 */
export function formatLockDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second(s)`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minute(s)`;
  return `${Math.ceil(seconds / 3600)} hour(s)`;
}
