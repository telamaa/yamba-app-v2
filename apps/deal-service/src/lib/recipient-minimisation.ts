/**
 * recipient-minimisation.ts — ce que le VOYAGEUR voit du destinataire, et quand
 * ==============================================================================
 * Recette API du 08/09/2026, fiche API-DEAL-06. La vue Voyageur portait le destinataire
 * **complet** — prénom, nom, téléphone ET email — dès le statut `ACCEPTED`, c'est-à-dire
 * avant même d'avoir le colis en main. Le code l'assumait (« il en a besoin pour livrer »),
 * ce qui est vrai du nom, discutable du téléphone, et faux de l'email.
 *
 * Le destinataire est un **tiers** : il n'est pas membre, il n'a rien accepté, et ses
 * coordonnées ont été confiées par l'Expéditeur pour un seul usage — la remise du colis.
 * La minimisation n'est donc pas une précaution de principe, c'est la limite de l'usage
 * pour lequel la donnée a été donnée.
 *
 * La règle retenue :
 *
 * | Étape | Ce que le Voyageur voit |
 * |---|---|
 * | Avant `PICKED_UP` | prénom et nom — de quoi savoir à qui il s'engage à livrer |
 * | À partir de `PICKED_UP` | prénom, nom **et téléphone** — le colis est en transit, il doit pouvoir joindre |
 * | Jamais | l'**email**, qui ne sert à aucun moment à remettre un colis |
 *
 * L'Expéditeur, lui, voit ce qu'il a saisi : sa vue n'est pas concernée.
 */

export type RecipientSnapshot = {
  firstName?: string | null;
  lastName?: string | null;
  phoneE164?: string | null;
  email?: string | null;
} | null;

/** Ce qui est servi au Voyageur : jamais l'email, le téléphone à partir de la prise en charge. */
export type CarrierRecipientView = {
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
} | null;

/** Les statuts à partir desquels le colis est entre les mains du Voyageur. */
const APRES_PRISE_EN_CHARGE = new Set(["PICKED_UP", "DELIVERED", "COMPLETED", "DISPUTED"]);

export function recipientForCarrier(recipient: RecipientSnapshot, status: string): CarrierRecipientView {
  if (!recipient) return null;
  const enTransit = APRES_PRISE_EN_CHARGE.has(status);
  return {
    firstName: recipient.firstName ?? null,
    lastName: recipient.lastName ?? null,
    phoneE164: enTransit ? recipient.phoneE164 ?? null : null,
  };
}
