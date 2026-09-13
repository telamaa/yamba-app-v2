/**
 * account-status.ts — le statut EFFECTIF d'un compte sanctionné (ANO-ADM-07, recette 02-ADMIN § 5.4)
 * ==================================================================================================
 * Une sanction se pose avec une date de fin facultative (« Jusqu'au », `User.suspensionUntil`), annoncée au
 * membre dans l'email (« jusqu'au 20 septembre 2026 »). Aucun lecteur ne la lisait : passé la date, le compte
 * restait refusé indéfiniment. Une sanction agit PAR LECTURE (D56 2A) : la date de fin se lit donc au même
 * endroit que le statut — dans les gardes et dans les filtres —, sans cron ni écriture croisée.
 *
 * Règles pures, sans dépendance : `now` est injecté pour les tests.
 */

export type AccountStatus = "ACTIVE" | "RESTRICTED" | "SUSPENDED";

/** Les champs d'un compte qui décident de son statut effectif (un `User` Prisma convient). */
export type SanctionState = { accountStatus?: string | null; suspensionUntil?: Date | string | null };

const dateOf = (d: Date | string | null | undefined): Date | null => (d ? (d instanceof Date ? d : new Date(d)) : null);

/** Vrai si le compte porte une sanction dont la date de fin est atteinte. */
export function sanctionExpired(u: SanctionState, now: Date = new Date()): boolean {
  const until = dateOf(u.suspensionUntil);
  return !!u.accountStatus && u.accountStatus !== "ACTIVE" && !!until && until.getTime() <= now.getTime();
}

/** Le statut qui s'applique MAINTENANT : une sanction échue vaut ACTIVE ; un statut absent vaut ACTIVE. */
export function effectiveAccountStatus(u: SanctionState, now: Date = new Date()): AccountStatus {
  const status = (u.accountStatus ?? "ACTIVE") as AccountStatus;
  if (status === "ACTIVE" || sanctionExpired(u, now)) return "ACTIVE";
  return status;
}

/** Borne basse de « date de fin passée » : voir `notSuspendedOwnerFilter`. */
export const EPOCH = new Date(0);

/**
 * Filtre Prisma (relation `user: { is: … }`) : le propriétaire n'est PAS suspendu à cet instant.
 *
 * ⚠ Piège payé en recette (§ 5.4) : dans un filtre de RELATION, Prisma + Mongo compare dans un pipeline où
 * `null` est inférieur à toute date (ordre BSON) — `suspensionUntil: { lte: now }` matchait donc une suspension
 * SANS date de fin, et les trajets d'un suspendu revenaient dans la recherche. La borne basse `gt: EPOCH`
 * exclut `null` ; un champ absent n'est matché par aucune des deux bornes (mesuré : null 0, absent 0,
 * fin à venir 0, fin passée = trajets visibles).
 */
export function notSuspendedOwnerFilter(now: Date = new Date()): { OR: Array<{ accountStatus: { not: "SUSPENDED" } } | { suspensionUntil: { lte: Date; gt: Date } }> } {
  return { OR: [{ accountStatus: { not: "SUSPENDED" } }, { suspensionUntil: { lte: now, gt: EPOCH } }] };
}

/** Filtre Prisma : les comptes dont la sanction `level` est EN COURS (sans fin, ou fin à venir). */
export function activeSanctionFilter(level: "RESTRICTED" | "SUSPENDED", now: Date = new Date()) {
  return { accountStatus: level, OR: [{ suspensionUntil: null }, { suspensionUntil: { isSet: false } }, { suspensionUntil: { gt: now } }] };
}
