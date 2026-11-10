/**
 * otp-display.ts — ce que l'écran de vérification MONTRE, et quand (D92 6A).
 * ==========================================================================
 * Deux règles, sorties de l'écran pour être vérifiables sans rendu (A223).
 *
 * ① UN SEUL COMPTE À REBOURS À L'ÉCRAN. L'écran en tenait deux, au même
 *    format `mm:ss`, à deux cents pixels l'un de l'autre : la validité du
 *    code (10 min) et le délai avant renvoi (1 min). `09:41` et `00:41`
 *    demandent un effort pour comprendre que ce ne sont pas les mêmes
 *    secondes. Et une horloge qui tourne sur une attente qu'on ne contrôle
 *    PAS n'informe pas : elle installe l'anxiété. La validité ne s'affiche
 *    donc qu'à sa dernière minute — là où elle devient actionnable (« je
 *    redemande un code plutôt que de chercher »). Le délai de renvoi, lui,
 *    est le seul compteur permanent : il dit quand on POURRA agir.
 *
 * ② L'AIDE ARRIVE QUAND ELLE SERT. « Vérifie tes spams » affiché à la
 *    seconde zéro accuse l'utilisateur d'un problème qu'il n'a pas encore :
 *    le mail est parti il y a un instant. Les vingt premières secondes
 *    annoncent le délai normal ; ensuite seulement l'écran propose de
 *    chercher ailleurs ; le lien de renvoi n'apparaît qu'avec le geste,
 *    jamais grisé au milieu d'une phrase (« … tes spams OU » suivi d'un
 *    non-geste laissait un « ou » pendre dans le vide pendant une minute).
 *
 * Jumeau web : `apps/user-ui/src/lib/auth/otp-display.ts`.
 */

/** Le TTL serveur du code (otp-policy.ts) — affiché, jamais décidé ici. */
export const OTP_EXPIRY_SECONDS = 600;
/** Le délai avant un nouvel envoi (client, anti-énumération). */
export const RESEND_COOLDOWN_SECONDS = 60;
/** La dernière minute : au-delà, la validité ne se regarde pas. */
export const VALIDITY_VISIBLE_SECONDS = 60;
/** Avant cela, l'aide accuserait l'utilisateur d'un retard qui n'existe pas. */
export const HELP_AFTER_SECONDS = 20;

/**
 * La pastille de validité se montre-t-elle ? Expiré (0) compris : c'est
 * précisément le moment où elle a quelque chose à dire.
 */
export function showValidity(
  expirySeconds: number,
  visibleUnder: number = VALIDITY_VISIBLE_SECONDS
): boolean {
  return expirySeconds <= visibleUnder;
}

/**
 * Les trois états du bloc de renvoi, dans l'ordre du temps :
 *   `early`   — le mail vient de partir, on annonce le délai normal ;
 *   `waiting` — il tarde : on propose les spams, et on dit QUAND redemander ;
 *   `ready`   — le geste est disponible.
 */
export type ResendPhase = 'early' | 'waiting' | 'ready';

export function resendPhase(
  resendSeconds: number,
  cooldown: number = RESEND_COOLDOWN_SECONDS,
  helpAfter: number = HELP_AFTER_SECONDS
): ResendPhase {
  if (resendSeconds <= 0) return 'ready';
  return resendSeconds > cooldown - helpAfter ? 'early' : 'waiting';
}
