/**
 * payment-choice.ts — le moyen de paiement choisi, en mémoire de processus.
 * ==========================================================================
 * Même motif que `booking-draft.ts`, `search-draft.ts` et `auth-flow-state.ts`,
 * et pour la même raison : la page de choix (`booking/payment/method`) est
 * POUSSÉE sur la pile, et une page poussée ne retourne rien à celle qui l'a
 * poussée — `router.back()` ne transporte pas de valeur.
 *
 * La page écrit, se referme, l'écran de paiement lit. Les abonnés sont
 * prévenus à chaque écriture (`useSyncExternalStore` côté écran) : pas de
 * scrutation, pas de rafraîchissement à l'ouverture.
 *
 * Ce choix MEURT avec le processus, et c'est voulu : il ne vaut que pour la
 * réservation en cours. Mémoriser « il paie toujours par PayPal » serait une
 * préférence de compte — un objet à part, côté serveur, que personne n'a
 * demandé.
 */
import { useSyncExternalStore } from 'react';

import { keepOrDefault, type PaymentMethodKey } from '@/lib/payment-methods';

let choisi: PaymentMethodKey | null = null;
/**
 * L'empreinte EN COURS, telle que les pages filles en ont besoin.
 *
 * Elle vit ici — et non dans un paramètre de route — pour une raison
 * précise : le `clientSecret` n'a rien à faire dans une URL. Une route est
 * journalisée, restaurée au redémarrage, parfois affichée ; un secret de
 * paiement ne doit traverser aucun de ces chemins. La mémoire de processus
 * meurt avec l'app, ce qui est exactement sa durée de vie utile.
 */
export type PendingIntent = {
  clientSecret: string;
  /** Le montant du DEVIS SERVEUR, en cents — ce que les feuilles affichent. */
  amountCents: number;
  currencyCode: string;
  /** `paymentMethodTypes` — ce que CETTE empreinte accepte (D83 4A). */
  types: readonly string[];
};

let empreinte: PendingIntent | null = null;
/**
 * L'empreinte est-elle POSÉE ? Écrit par la page du moyen choisi (carte,
 * PayPal, portefeuille), lu par l'écran de paiement quand il reprend la main.
 *
 * C'est le seul moyen pour une page POUSSÉE de rendre un résultat : elle ne
 * retourne rien en se refermant. Et c'est un drapeau, pas une preuve — le
 * serveur RELIT l'état réel chez le fournisseur avant de créer la demande
 * (D82 8A). Un `true` menteur ne fait donc pas de dégât : il fait un refus.
 */
let autorisee = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore` exige une valeur STABLE tant que rien ne change. */
export function getPaymentChoice(): PaymentMethodKey | null {
  return choisi;
}

export function setPaymentChoice(key: PaymentMethodKey | null): void {
  if (choisi === key) return; // pas d'écriture inutile : pas de rendu inutile
  choisi = key;
  emit();
}

export function clearPaymentChoice(): void {
  empreinte = null;
  autorisee = false;
  setPaymentChoice(null);
  emit();
}

/** L'empreinte en cours, ou `null` tant qu'il n'y en a pas. */
export function getPendingIntent(): PendingIntent | null {
  return empreinte;
}

/** Les moyens servis par l'empreinte courante. Liste vide tant qu'il n'y en a
 *  pas — le Fake n'en annonce aucun, et c'est un état légitime. */
export function getIntentMethods(): readonly string[] {
  return empreinte?.types ?? [];
}

/**
 * Posée par l'écran de paiement à chaque nouvelle intention.
 *
 * Une intention NEUVE n'a jamais été autorisée : garder le drapeau ferait
 * croire à une empreinte posée sur une empreinte qui n'existe plus — et la
 * demande partirait sur un identifiant mort.
 */
export function setPendingIntent(next: PendingIntent | null): void {
  // La liste est COPIÉE : la mémoire ne partage pas son tableau avec
  // l'appelant. Sans cela, une mutation du dehors changerait silencieusement
  // les moyens proposés — et c'est le genre de lien invisible qu'on ne
  // retrouve qu'à la recette.
  empreinte = next === null ? null : { ...next, types: [...next.types] };
  autorisee = false;
  emit();
}

/** L'empreinte a-t-elle été posée pour l'intention courante ? */
export function isPaymentAuthorized(): boolean {
  return autorisee;
}

/** Posé par la page du moyen, juste avant de se refermer. */
export function markPaymentAuthorized(): void {
  if (autorisee) return;
  autorisee = true;
  emit();
}

export function subscribePaymentChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Le choix à AFFICHER, confronté à ce que l'empreinte accepte vraiment.
 *
 * Entre le moment où l'Expéditeur a choisi et celui où l'écran se rouvre,
 * l'intention a pu être recréée avec d'autres moyens (changement au Dashboard,
 * montant différent, portefeuille devenu indisponible). On ne garde donc
 * jamais un choix que la liste ne porte plus — le ramener au défaut vaut mieux
 * que d'afficher une ligne morte (A209).
 *
 * ELLE NE MÉMORISE RIEN, et c'est un choix payé : une première version
 * normalisait la mémoire au passage. Les écrans l'appelaient pour AFFICHER,
 * donc pendant leur rendu, donc elle prévenait les abonnés pendant un rendu —
 * et React refuse : « Cannot update a component while rendering a different
 * component ». La règle qui en sort vaut pour toutes les mémoires du dépôt :
 *
 *     une fonction qui RÉPOND à une question n'ÉCRIT jamais.
 *
 * La normalisation de la mémoire se fait donc dans un effet, par un appel
 * explicite à `setPaymentChoice`.
 */
export function resolvedChoice(
  disponibles: readonly PaymentMethodKey[]
): PaymentMethodKey | null {
  return keepOrDefault(choisi, disponibles);
}

export function usePaymentChoice(): PaymentMethodKey | null {
  return useSyncExternalStore(subscribePaymentChoice, getPaymentChoice, getPaymentChoice);
}
