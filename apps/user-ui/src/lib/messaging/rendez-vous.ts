/**
 * rendez-vous.ts — se retrouver, côté SITE (D118 bis).
 * ======================================================
 * Zéro import : le harnais du site (A224) doit pouvoir jouer ces règles, et
 * un écran ne doit pas tirer zod dans le bundle du navigateur pour connaître
 * deux bornes.
 *
 * ── CE QUE L'ÉCRAN NATIF A RÉVÉLÉ ICI ───────────────────────────────────
 *   ① `MeetupPanel` ne posait **aucune** borne de longueur : le lieu
 *      (3..160) et le repère (≤ 500) sont refusés par le contrat, et le
 *      membre tapait jusqu'à l'échec. C'est `PickupNotes` de D115 bis,
 *      replayé à deux champs près ;
 *   ② sur les CINQ motifs de refus de créneau, deux tombaient dans un
 *      message générique — dont `END_BEFORE_START`, qui est l'erreur la
 *      plus probable d'un formulaire à deux `datetime-local` : celui qui
 *      intervertit début et fin lisait « Le rendez-vous n'a pas pu être
 *      proposé », c'est-à-dire rien.
 *
 * Le natif, lui, ne PEUT PAS exprimer ces deux refus (D118 1A) — mais le
 * site garde son formulaire : sur un écran large, avec une souris, deux
 * champs de date sont un geste légitime. On ne transpose pas le contrôle,
 * on transpose ce qu'il DIT.
 */

/** Les bornes du contrat (`ProposeMeetupRequestSchema`). */
export const LIEU_MIN = 3;
export const LIEU_MAX = 160;
export const DETAIL_MAX = 500;

/** À partir de combien de caractères restants on montre le compteur. */
export const SEUIL_DU_COMPTEUR = 20;

/**
 * La clé de phrase d'un refus de rendez-vous.
 *
 * Les CINQ motifs de créneau sont nommés, pas trois : un refus qui tombe
 * dans un message générique ne dit rien à celui qui doit le corriger.
 */
export function cleDuRefusDuRendezVous(code: unknown, raison: unknown): string {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  const r = typeof raison === "string" ? raison.trim().toUpperCase() : "";
  if (c === "CONVERSATION_READ_ONLY") return "ferme";
  if (c === "MEETUP_CHANGED") return "change";
  if (c === "MEETUP_NOT_ACCEPTABLE") return r === "OWN_PROPOSAL" ? "sienne" : "change";
  if (c === "MEETUP_NOT_FOUND") return "introuvable";
  if (c === "INVALID_MEETUP_SLOT") {
    if (r === "TOO_SOON") return "tropTot";
    if (r === "TOO_FAR") return "tropLoin";
    if (r === "WINDOW_TOO_LONG") return "tropLong";
    if (r === "END_BEFORE_START") return "finAvantDebut";
    return "creneau";
  }
  return "echec";
}

/** Combien de caractères restent, et faut-il le dire ? */
export function restantDuChamp(valeur: string, plafond: number): number | null {
  const restant = plafond - valeur.length;
  return restant <= SEUIL_DU_COMPTEUR ? Math.max(0, restant) : null;
}
