/**
 * counterpart-label.ts — le nom de la contrepartie dans un fil (D63, recette 5.25)
 * ================================================================================
 * Un compte effacé garde ses messages (« sans ton nom », RGPD) : son identité est anonymisée en base
 * (`firstName = "Membre"`, `lastName = "supprimé"`, `isDeleted = true`). La messagerie n'affichait que le
 * PRÉNOM — « Membre » — qui se lit comme un prénom ordinaire (ANO-WEB-83). Le fil dit désormais
 * « Membre supprimé », le même libellé que le back-office.
 *
 * Règle pure, sans Prisma : le service charge, la règle nomme.
 */
export const LIBELLE_MEMBRE_SUPPRIME = "Membre supprimé";

export function nomDeLaContrepartie(user: { firstName?: string | null; isDeleted?: boolean | null } | null | undefined): string {
  if (!user) return "—";
  if (user.isDeleted) return LIBELLE_MEMBRE_SUPPRIME;
  return user.firstName ?? "—";
}
