/**
 * booking.api.ts — les deux appels qui engagent l'argent (D37, B2).
 * ==================================================================
 * Dans cet ordre, et jamais autrement :
 *   1. `POST /deals/payment-intents` — le serveur RECALCULE le devis (D34) et
 *      pose l'empreinte bancaire : autorisation maintenant, débit seulement
 *      quand le Voyageur accepte (D31, capture manuelle) ;
 *   2. `POST /deals` — la même saisie plus `paymentIntentId`. Le serveur
 *      revérifie tout, réserve les kilos (CAP-01) et crée le Booking PENDING
 *      avec son événement d'outbox, dans UNE transaction.
 *
 * `expectedTotalCents` est ce que l'Expéditeur a VU à l'écran. Si le serveur
 * calcule autre chose, il refuse (409 `QUOTE_DIVERGENCE`) : rien n'est jamais
 * débité d'un montant qui n'a pas été montré (D17). C'est la raison pour
 * laquelle le mobile calcule son devis localement avec le MÊME moteur
 * (`@packages/pricing`) et les paramètres courants de la plateforme (D62) —
 * non pour décider, mais pour que les deux calculs tombent d'accord.
 *
 * Miroir assumé de `apps/user-ui/src/services/booking.api.ts` : même ordre,
 * mêmes champs, mêmes codes de refus. La divergence tiendrait dans ce que le
 * serveur voit, c'est-à-dire nulle part.
 */
import type { PricingParams } from '@packages/pricing';

import type { BookingDraft } from '@/lib/booking-draft';
import { parseWeight, quoteDraft } from '@/lib/booking-rules';
import { toE164 } from '@/lib/phone-prefixes';

import { ApiError, apiFetch } from './client';
import type { PublicTrip, TripLocationPoint } from './trip.api';

/** La part « colis » du devis, commune aux deux appels. */
type QuoteFields = {
  tripId: string;
  product: BookingDraft['product'];
  family: BookingDraft['family'];
  sizeClass: BookingDraft['sizeClass'] | null;
  weightKg: number | null;
  protection: BookingDraft['protection'];
  expectedTotalCents: number;
};

/** Le devis du SERVEUR — celui qui sera figé dans le Booking (D17). */
export type ServerQuote = {
  transportCents: number;
  commissionCents: number;
  premiumCents: number;
  totalShipperCents: number;
  currencyCode: string;
  billableWeightKg?: number | null;
  minimumApplied?: boolean | null;
  pricePerKgCents?: number | null;
  weightKg?: number;
};

export type PaymentIntentInfo = {
  provider: 'STRIPE' | 'FAKE';
  paymentIntentId: string;
  /** `null` chez le fournisseur FAKE : il n'y a aucune feuille à ouvrir. */
  clientSecret: string | null;
  amountCents: number;
  currencyCode: string;
  quote: ServerQuote;
};

export type CreatedBooking = {
  bookingId: string;
  status: string;
  /** Fin du délai d'acceptation de 24 h (DEA-01), en ISO. */
  expiresAt: string;
  totalShipperCents: number;
  currencyCode: string;
};

/** Le devis n'est pas calculable : on ne tente même pas l'autorisation. */
export class QuoteUnavailableError extends Error {
  readonly code = 'QUOTE_UNAVAILABLE';
  constructor() {
    super('Quote unavailable');
    this.name = 'QuoteUnavailableError';
  }
}

/** « 450 » ou « 450,50 » → 45050. Vide ou illisible → 0, le serveur tranchera. */
export function declaredValueCents(draft: BookingDraft): number {
  return Math.round((parseFloat(draft.declaredValueEur.replace(',', '.')) || 0) * 100);
}

function quoteFields(draft: BookingDraft, trip: PublicTrip, params: PricingParams): QuoteFields {
  const quote = quoteDraft(draft, trip, params);
  if (quote.ok !== true) throw new QuoteUnavailableError();
  const isParcel = draft.product === 'PARCEL';
  return {
    tripId: trip.id,
    product: draft.product,
    family: draft.family,
    sizeClass: isParcel ? draft.sizeClass : null,
    weightKg: isParcel ? parseWeight(draft.weightKg) : null,
    protection: draft.protection,
    expectedTotalCents: quote.quote.totalShipperCents,
  };
}

/** Le lieu choisi, rendu au contrat : son genre et son précision. */
function placeAt(points: TripLocationPoint[], index: number | null) {
  if (index === null) return null;
  const point = points[index];
  return point ? { kind: point.kind, details: point.details } : null;
}

export async function createPaymentIntent(
  draft: BookingDraft,
  trip: PublicTrip,
  params: PricingParams
): Promise<PaymentIntentInfo> {
  return apiFetch<PaymentIntentInfo>('/deals/payment-intents', {
    method: 'POST',
    body: {
      ...quoteFields(draft, trip, params),
      // ANO-API-12 : la valeur déclarée part AVEC l'intention, pour que le
      // plafond progressif (CNF-06, D71) tombe AVANT toute empreinte bancaire.
      declaredValueCents: declaredValueCents(draft),
    },
  });
}

export async function createBooking(
  draft: BookingDraft,
  trip: PublicTrip,
  paymentIntentId: string,
  photoUrls: string[],
  params: PricingParams
): Promise<CreatedBooking> {
  const phoneE164 = toE164(draft.recipient.phonePrefix, draft.recipient.phoneNational);
  // Barré à l'étape ⑤ : si on arrive ici sans numéro valable, c'est un défaut
  // de parcours, pas une saisie à corriger.
  if (!phoneE164) throw new ApiError(0, 'Invalid recipient phone', 'GENERIC', null);

  return apiFetch<CreatedBooking>('/deals', {
    method: 'POST',
    body: {
      ...quoteFields(draft, trip, params),
      paymentIntentId,
      description: draft.description.trim(),
      declaredValueCents: declaredValueCents(draft),
      photoUrls,
      recipient: {
        firstName: draft.recipient.firstName.trim(),
        lastName: draft.recipient.lastName.trim(),
        phoneE164,
        // Facultatif : le contrat attend `null`, jamais une chaîne vide.
        email: draft.recipient.email.trim() || null,
      },
      pickupPlace: placeAt(trip.pickupLocations, draft.pickupIndex),
      deliveryPlace: placeAt(trip.deliveryLocations, draft.deliveryIndex),
      charterAccepted: draft.charterAccepted,
      termsAccepted: draft.termsAccepted,
    },
  });
}
