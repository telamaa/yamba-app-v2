/**
 * recipient.ts — « peut-on écrire à ce compte ? » (D35 4A), UNE règle pour tous les résolveurs
 * ===========================================================================================
 * Chaque service réécrivait son propre test (`isDeleted || emailSuppressedAt`) — et deux l'avaient
 * oublié (recette 02-ADMIN § 5.5 : ANO-ADM-10 emails d'administration des trajets, ANO-ADM-11 emails
 * aux super administrateurs). La règle vit ici, pure, avec le fragment Prisma qui la traduit.
 *
 * Piège Mongo : `emailSuppressedAt: null` ne voit pas un champ ABSENT → `OR [null, isSet: false]`.
 * Le fragment est rendu sous `AND` pour ne jamais écraser un `OR` de l'appelant.
 */

export type EmailRecipientCandidate = {
  email?: string | null;
  isDeleted?: boolean | null;
  emailSuppressedAt?: Date | string | null;
};

/** Pur : vrai si un email transactionnel peut partir vers ce compte. */
export function canReceiveEmail(u: EmailRecipientCandidate | null | undefined): boolean {
  if (!u || !u.email || !u.email.trim()) return false;
  if (u.isDeleted) return false;
  return !u.emailSuppressedAt;
}

/** Fragment Prisma à combiner : `where: { ...autres, AND: [reachableRecipientWhere()] }`. */
export function reachableRecipientWhere(): { isDeleted: false; OR: Array<Record<string, unknown>> } {
  return { isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] };
}

/** Libellé français du motif de suppression (fiche admin, emails internes). */
export function suppressionReasonLabel(reason: string | null | undefined): string {
  if (reason === "HARD_BOUNCE") return "rebond dur";
  if (reason === "COMPLAINT") return "plainte";
  return "motif non renseigné";
}
