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
  empreinte = next;
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
 * jamais un choix que la liste ne porte plus — et le ramener au défaut vaut
 * mieux que d'afficher une ligne morte (A209).
 *
 * La fonction NORMALISE aussi la mémoire au passage : si le choix a dû être
 * remplacé, c'est le remplaçant qui est mémorisé, pour que l'écran de choix
 * et l'écran de paiement ne se contredisent jamais.
 */
export function resolvePaymentChoice(
  disponibles: readonly PaymentMethodKey[]
): PaymentMethodKey | null {
  const retenu = keepOrDefault(choisi, disponibles);
  if (retenu !== choisi) setPaymentChoice(retenu);
  return retenu;
}

export function usePaymentChoice(): PaymentMethodKey | null {
  return useSyncExternalStore(subscribePaymentChoice, getPaymentChoice, getPaymentChoice);
}
