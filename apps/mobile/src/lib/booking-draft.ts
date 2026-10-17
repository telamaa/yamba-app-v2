/**
 * booking-draft.ts — le brouillon de réservation, en mémoire de PROCESSUS.
 * ========================================================================
 * Le parcours de réservation est une PILE de pages poussées (sept étapes,
 * une décision par page). Une page poussée ne retourne pas de valeur à celle
 * qui l'a poussée : chaque étape écrit donc dans un brouillon partagé, et
 * les écrans s'y abonnent par `useSyncExternalStore`. C'est exactement le
 * motif de `search-draft.ts` (recherche) et d'`auth-flow-state.ts` (auth) —
 * un objet de module, un `Set` d'abonnés, zéro contexte React à traîner.
 *
 * Deux propriétés VOULUES :
 *   • le brouillon meurt avec le processus (app tuée = parcours perdu) —
 *     correct pour une réservation non payée, qui n'engage rien ;
 *   • il est lié à UN trajet (`tripId`) : ouvrir la réservation d'un autre
 *     trajet repart d'un brouillon neuf, jamais des miettes du précédent.
 *
 * Rien ici ne calcule ni ne valide : les règles pures vivent dans
 * `booking-rules.ts`, le serveur reste seul juge (RG-MOB-1).
 */
import { useSyncExternalStore } from 'react';

import type { PublicTrip } from '@/lib/api/trip.api';
import { firstAcceptedFamily } from '@/lib/booking-rules';

/** Les 8 familles de risque (D14) — mêmes clés que l'API. */
export type ParcelFamily =
  | 'DOCUMENTS_PAPERS'
  | 'CLOTHES_TEXTILE'
  | 'FOOD_DRY_SEALED'
  | 'ELECTRONICS_DEVICES'
  | 'COSMETICS_CARE'
  | 'PARTS_TOOLS'
  | 'TOYS_CHILDCARE'
  | 'MISC_ACCESSORIES';

/** PRC-03 — classes de taille visuelles. */
export type SizeClass = 'S' | 'M' | 'L';

/** PRC-04 — ce qu'on envoie : un colis au kilo, ou un bagage entier forfaitaire. */
export type ParcelProduct = 'PARCEL' | 'CHECKED_BAG_23KG' | 'CABIN_BAG_12KG';

/** D22 — niveau de protection. Le mot « assurance » ne s'affiche nulle part (ANO-WEB-33). */
export type ProtectionTier = 'BASIC' | 'EXTENDED_500';

/** Une photo déclarée : l'URI locale tant qu'elle n'est pas téléversée (lot photos). */
export type BookingPhoto = {
  id: string;
  uri: string;
  context: 'DECLARED_CONTENT' | 'DECLARED_PACKAGED' | 'CUSTOM';
};

export type BookingRecipient = {
  firstName: string;
  lastName: string;
  phonePrefix: string;
  phoneNational: string;
};

export type BookingDraft = {
  /** Le trajet auquel ce brouillon appartient — change ⇒ brouillon neuf. */
  tripId: string | null;
  product: ParcelProduct;
  family: ParcelFamily;
  sizeClass: SizeClass;
  /** Saisi, donc TEXTE (« 2,5 ») : la conversion est une règle, pas un état. */
  weightKg: string;
  declaredValueEur: string;
  description: string;
  photos: BookingPhoto[];
  protection: ProtectionTier;
  /** Index dans `trip.pickupLocations` / `trip.deliveryLocations` (le DTO public n'a pas d'id). */
  pickupIndex: number | null;
  deliveryIndex: number | null;
  recipient: BookingRecipient;
  charterAccepted: boolean;
  termsAccepted: boolean;
};

const EMPTY: BookingDraft = {
  tripId: null,
  product: 'PARCEL',
  family: 'CLOTHES_TEXTILE',
  sizeClass: 'S',
  // D33 — sans rien de saisi, on part du colis de RÉFÉRENCE (2 kg) : la barre
  // de prix annonce tout de suite un vrai total, jamais un « 0 € » muet.
  weightKg: '2',
  declaredValueEur: '',
  description: '',
  photos: [],
  protection: 'BASIC',
  pickupIndex: null,
  deliveryIndex: null,
  recipient: { firstName: '', lastName: '', phonePrefix: '+33', phoneNational: '' },
  charterAccepted: false,
  termsAccepted: false,
};

let draft: BookingDraft = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** La MÊME référence tant que rien n'a changé — contrat de `useSyncExternalStore`. */
export function getBookingDraft(): BookingDraft {
  return draft;
}

export function subscribeBookingDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBookingDraft(patch: Partial<BookingDraft>): void {
  draft = { ...draft, ...patch };
  emit();
}

export function clearBookingDraft(): void {
  draft = EMPTY;
  emit();
}

/**
 * Ouvre (ou rouvre) un brouillon pour CE trajet. Même trajet ⇒ on reprend où
 * on en était (l'Expéditeur est juste revenu en arrière) ; autre trajet ⇒ tout
 * repart à zéro, avec les choix que le trajet impose déjà :
 *   • la première famille ACCEPTÉE par le Voyageur (jamais une refusée) ;
 *   • un seul lieu proposé ⇒ il est choisi d'office (rien à décider).
 */
export function startBookingDraft(trip: PublicTrip): void {
  if (draft.tripId === trip.id) return;
  draft = {
    ...EMPTY,
    tripId: trip.id,
    family: firstAcceptedFamily(trip),
    pickupIndex: trip.pickupLocations.length === 1 ? 0 : null,
    deliveryIndex: trip.deliveryLocations.length === 1 ? 0 : null,
  };
  emit();
}

export function useBookingDraft(): BookingDraft {
  return useSyncExternalStore(subscribeBookingDraft, getBookingDraft, getBookingDraft);
}
