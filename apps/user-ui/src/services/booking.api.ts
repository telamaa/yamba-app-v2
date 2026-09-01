/**
 * booking.api.ts — appels réels au deal-service via le gateway (B2, D37)
 * ======================================================================
 * Deux appels dans l'ordre :
 *   1. createPaymentIntent — le serveur recalcule le devis (D34) et pose
 *      l'empreinte (autorisation, débit à l'acceptation — D31).
 *   2. createDeal — même saisie + paymentIntentId : le serveur re-vérifie
 *      tout et crée le deal PENDING dans une transaction.
 *
 * `expectedTotalCents` = ce que l'Expéditeur a VU (devis @packages/pricing).
 * Si le serveur trouve autre chose → 409 QUOTE_DIVERGENCE : on rafraîchit,
 * jamais un débit d'un montant non vu (D17).
 */

import axiosInstance from "@/lib/api-client";
import { computeTotal, parseWeight, recipientPhoneE164 } from "@/components/booking/booking.config";
import type {
  BookingApiErrorCode,
  CreateDealResponse,
  Draft,
  PaymentIntentInfo,
  PriceBreakdown,
  TripContext,
} from "@/components/booking/booking.types";

const KIND_TO_API: Record<string, "AIRPORT" | "TRAIN_STATION" | "CITY_AREA"> = {
  AIRPORT: "AIRPORT",
  TRAIN_STATION: "TRAIN_STATION",
  BUS_STATION: "CITY_AREA",
  ADDRESS: "CITY_AREA",
};

/** Erreur métier du deal-service (409 + details.code) — le composant traduit `code`. */
export class BookingApiError extends Error {
  readonly code: BookingApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: BookingApiErrorCode, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function toBookingError(e: unknown): BookingApiError {
  const err = e as { response?: { status?: number; data?: { message?: string; details?: Record<string, unknown> } } };
  const status = err.response?.status ?? 0;
  const details = err.response?.data?.details ?? {};
  const code = (typeof details.code === "string" ? details.code : status === 401 ? "UNAUTHENTICATED" : "GENERIC") as BookingApiErrorCode;
  return new BookingApiError(code, status, err.response?.data?.message ?? "Booking request failed", details);
}

function quoteFields(draft: Draft, trip: TripContext, price: PriceBreakdown) {
  if (!price.quote) throw new BookingApiError("QUOTE_UNAVAILABLE", 0, price.quoteError ?? "Quote unavailable");
  return {
    tripId: trip.tripId,
    product: draft.product,
    family: draft.family,
    sizeClass: draft.product === "PARCEL" ? draft.sizeClass : null,
    weightKg: draft.product === "PARCEL" ? parseWeight(draft.weightKg) : null,
    protection: draft.insurance,
    expectedTotalCents: price.quote.totalShipperCents,
  };
}

function placeOf(options: TripContext["pickupOptions"], id: string | null) {
  const p = options.find((o) => o.id === id);
  return p ? { kind: KIND_TO_API[p.kind] ?? "CITY_AREA", details: p.subLabel ?? null } : null;
}

export async function createPaymentIntent(draft: Draft, trip: TripContext): Promise<PaymentIntentInfo> {
  const price = computeTotal(draft, trip);
  try {
    const res = await axiosInstance.post<PaymentIntentInfo>("/deals/payment-intents", quoteFields(draft, trip, price));
    return res.data;
  } catch (e) {
    throw e instanceof BookingApiError ? e : toBookingError(e);
  }
}

export async function createDeal(draft: Draft, trip: TripContext, paymentIntentId: string): Promise<CreateDealResponse> {
  const price = computeTotal(draft, trip);
  const phoneE164 = recipientPhoneE164(draft);
  if (!phoneE164) throw new BookingApiError("GENERIC", 0, "Invalid recipient phone");
  const body = {
    ...quoteFields(draft, trip, price),
    paymentIntentId,
    description: draft.description.trim(),
    declaredValueCents: Math.round((parseFloat(draft.declaredValueEur.replace(",", ".")) || 0) * 100),
    // Les photos restent locales tant que media-service (B2.3) n'existe pas :
    // le serveur accepte une liste vide.
    photoUrls: [] as string[],
    recipient: {
      firstName: draft.recipient.firstName.trim(),
      lastName: draft.recipient.lastName.trim(),
      phoneE164,
      // Optionnel (spec É1) : le contrat attend null, jamais une chaîne vide.
      email: draft.recipient.email.trim() || null,
    },
    pickupPlace: placeOf(trip.pickupOptions, draft.pickupLocationId),
    deliveryPlace: placeOf(trip.deliveryOptions, draft.deliveryLocationId),
    charterAccepted: draft.charterAccepted,
    termsAccepted: draft.termsAccepted,
  };
  try {
    const res = await axiosInstance.post<CreateDealResponse>("/deals", body);
    return res.data;
  } catch (e) {
    throw e instanceof BookingApiError ? e : toBookingError(e);
  }
}

/** Devis pour le récap — pur, même moteur que le serveur (D34). */
export function computePrice(draft: Draft, trip: TripContext): PriceBreakdown {
  return computeTotal(draft, trip);
}
