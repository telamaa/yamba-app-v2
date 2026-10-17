/**
 * booking-rules.ts — les règles PURES de la réservation côté app.
 * ===============================================================
 * Miroir mobile de `apps/user-ui/src/components/booking/booking.config.ts`,
 * avec une différence de principe : **ici, rien n'est une phrase**. Les
 * validations rendent des CODES, l'écran les traduit — c'est la règle du
 * dépôt (jamais un `fr ? … : …`, D44) et c'est ce qui rend ces fonctions
 * testables sans i18n.
 *
 * Le devis vient de `@packages/pricing` — LE moteur, le même code que le
 * snapshot serveur (D34) : le front PROJETTE, le serveur TRANCHE et fige
 * (D17). Aucune formule n'est réécrite ici.
 *
 * Les paramètres (`PricingParams`) sont ceux servis par la plateforme
 * (`GET /trips/pricing/params`, D62) ; les défauts du moteur ne sont qu'un
 * repli tant que la réponse n'est pas là.
 */
import {
  PRICING_PARAMS,
  QuoteError,
  quoteShipperPrice,
  type PricingParams,
  type ShipperQuote,
} from '@packages/pricing';

import type { PublicTrip, TripFamilyCondition } from '@/lib/api/trip.api';
import type { BookingDraft, ParcelFamily, ParcelProduct, SizeClass } from '@/lib/booking-draft';

/** Ordre d'affichage des 8 familles (D14) — le même que le site. */
export const PARCEL_FAMILIES: readonly ParcelFamily[] = [
  'DOCUMENTS_PAPERS',
  'CLOTHES_TEXTILE',
  'FOOD_DRY_SEALED',
  'ELECTRONICS_DEVICES',
  'COSMETICS_CARE',
  'PARTS_TOOLS',
  'TOYS_CHILDCARE',
  'MISC_ACCESSORIES',
] as const;

export const SIZE_CLASSES: readonly SizeClass[] = ['S', 'M', 'L'] as const;

/** CAP-01 — plafond par colis, vérifié AUSSI par le serveur. */
export const MAX_PARCEL_KG = 30;

export type FamilyStance = { mode: 'ACCEPT' | 'SURCHARGE' | 'REFUSE'; surchargePct: number };

const ACCEPTED: FamilyStance = { mode: 'ACCEPT', surchargePct: 0 };

/**
 * La position du Voyageur sur une famille. Un trajet qui ne déclare RIEN
 * accepte tout : l'absence de condition n'est pas un refus (le DTO public ne
 * porte `familyConditions` que si le Voyageur les a posées).
 */
export function familyStance(trip: PublicTrip, family: ParcelFamily): FamilyStance {
  const conditions: TripFamilyCondition[] = trip.familyConditions ?? [];
  const found = conditions.find((condition) => condition.familyKey === family);
  if (!found) return ACCEPTED;
  return { mode: found.mode, surchargePct: Math.max(0, found.surchargePct ?? 0) };
}

/** La première famille que le Voyageur ne refuse pas — jamais une porte fermée par défaut. */
export function firstAcceptedFamily(trip: PublicTrip): ParcelFamily {
  return (
    PARCEL_FAMILIES.find((family) => familyStance(trip, family).mode !== 'REFUSE') ??
    PARCEL_FAMILIES[0]
  );
}

/** « 2,5 » → 2.5 ; null si ce n'est pas un poids strictement positif. */
export function parseWeight(input: string): number | null {
  const value = Number(String(input).replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Les kilos que consomme le produit choisi (un bagage entier a un poids forfaitaire). */
export function capacityNeededKg(draft: BookingDraft): number | null {
  if (draft.product === 'CHECKED_BAG_23KG') return 23;
  if (draft.product === 'CABIN_BAG_12KG') return 12;
  return parseWeight(draft.weightKg);
}

/** Les produits que CE trajet propose réellement (un forfait absent n'est pas une option). */
export function offeredProducts(trip: PublicTrip): ParcelProduct[] {
  const products: ParcelProduct[] = [];
  if (typeof trip.pricePerKgCents === 'number' && trip.pricePerKgCents > 0) products.push('PARCEL');
  if (typeof trip.checkedBag23PriceCents === 'number' && trip.checkedBag23PriceCents > 0) {
    products.push('CHECKED_BAG_23KG');
  }
  if (typeof trip.cabinBag12PriceCents === 'number' && trip.cabinBag12PriceCents > 0) {
    products.push('CABIN_BAG_12KG');
  }
  return products;
}

// ============================================================
// Étape « Le colis » — validation
// ============================================================

export type ParcelErrorCode =
  | 'FAMILY_REFUSED'
  | 'BAG_NOT_OFFERED'
  | 'NOT_ENOUGH_CAPACITY'
  | 'WEIGHT_REQUIRED'
  | 'WEIGHT_MAX'
  | 'WEIGHT_REMAINING';

export type ParcelErrors = Partial<Record<'product' | 'family' | 'weightKg', ParcelErrorCode>>;

/**
 * Ce qui empêche de continuer à l'étape « Le colis ». Tout est RE-vérifié par
 * le serveur à la création de la réservation (RG-MOB-1) : ces règles servent à
 * ne pas faire marcher l'Expéditeur jusqu'au paiement pour rien.
 */
export function validateParcelStep(draft: BookingDraft, trip: PublicTrip): ParcelErrors {
  const errors: ParcelErrors = {};
  const remainingKg = typeof trip.remainingKg === 'number' ? trip.remainingKg : null;

  if (draft.product === 'PARCEL') {
    if (familyStance(trip, draft.family).mode === 'REFUSE') errors.family = 'FAMILY_REFUSED';
    const weight = parseWeight(draft.weightKg);
    if (weight === null) {
      errors.weightKg = 'WEIGHT_REQUIRED';
    } else if (weight > MAX_PARCEL_KG) {
      errors.weightKg = 'WEIGHT_MAX';
    } else if (remainingKg !== null && weight > remainingKg) {
      errors.weightKg = 'WEIGHT_REMAINING';
    }
  } else if (!offeredProducts(trip).includes(draft.product)) {
    errors.product = 'BAG_NOT_OFFERED';
  } else {
    const needed = capacityNeededKg(draft);
    if (remainingKg !== null && needed !== null && needed > remainingKg) {
      errors.product = 'NOT_ENOUGH_CAPACITY';
    }
  }

  return errors;
}

// ============================================================
// Devis
// ============================================================

export type QuoteResult =
  | { ok: true; quote: ShipperQuote }
  | { ok: false; code: string };

/**
 * Le total ESTIMÉ de l'Expéditeur, par le moteur partagé. Un devis
  * impossible (trajet sans prix au kilo, poids absent, forfait non proposé)
 * n'est pas une erreur d'écran : c'est un état que la barre de prix DIT.
 */
export function quoteDraft(
  draft: BookingDraft,
  trip: PublicTrip,
  params: PricingParams = PRICING_PARAMS
): QuoteResult {
  try {
    const stance = familyStance(trip, draft.family);
    const quote = quoteShipperPrice(
      {
        product: draft.product,
        pricePerKgCents: trip.pricePerKgCents ?? null,
        checkedBag23PriceCents: trip.checkedBag23PriceCents ?? null,
        cabinBag12PriceCents: trip.cabinBag12PriceCents ?? null,
        weightKg: parseWeight(draft.weightKg),
        sizeClass: draft.sizeClass,
        familySurchargePct: stance.mode === 'SURCHARGE' ? stance.surchargePct : 0,
        protection: draft.protection,
      },
      params
    );
    return { ok: true, quote };
  } catch (error) {
    return { ok: false, code: error instanceof QuoteError ? error.code : 'UNKNOWN' };
  }
}
