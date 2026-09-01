/**
 * booking-request.ts — logique PURE de la naissance d'un deal (B2, D37)
 * =====================================================================
 * Emplacement : apps/deal-service/src/services/booking-request.ts
 *
 * Tout ce qui peut se tester sans base ni Stripe vit ici :
 *   - `resolveFamilySurcharge`  : la position du Voyageur sur la famille
 *                                 (ACCEPT / SURCHARGE % / REFUSE) → supplément
 *   - `buildQuoteInput`         : saisie Expéditeur + trajet → entrée du
 *                                 moteur unique (@packages/pricing, D34)
 *   - `checkTripBookable`       : le trajet accepte-t-il une demande ?
 *   - `assertQuoteMatches`      : ce que l'Expéditeur a VU = ce que le
 *                                 serveur figera (D17), sinon QUOTE_DIVERGENCE
 *   - `buildBookingSnapshots`   : les 5 snapshots immuables du Booking
 *   - `FAMILY_DEFAULT_CATEGORY` : famille D14 → catégorie legacy (A29)
 *
 * Le service d'écriture (deal-request.service.ts) ne fait qu'orchestrer :
 * charger, appeler ces fonctions, écrire dans UNE transaction.
 */

import { AppError } from "@packages/error-handler";
import {
  quoteShipperPrice,
  type QuoteInput,
  type ShipperQuote,
} from "@packages/pricing";
import type {
  BookingQuoteInput,
  BookingRequestErrorCode,
  CreateBookingRequest,
  ParcelFamily,
} from "@packages/api-contracts";

/* ══ Erreur métier 409 avec code (le front traduit) ═══════════ */

export class BookingRequestError extends AppError {
  readonly code: BookingRequestErrorCode;
  constructor(code: BookingRequestErrorCode, message: string, extra?: Record<string, unknown>) {
    // details.type = "booking" est dans la liste « safe » du middleware :
    // exposé même en production — le front a BESOIN du code pour traduire.
    super(message, 409, true, { type: "booking", code, ...(extra ?? {}) });
    this.code = code;
  }
}

/* ══ Vue minimale du Trip nécessaire ici (pas de dépendance Prisma) ══ */

export type TripForBooking = {
  id: string;
  userId: string; // le Voyageur
  status: string;
  isDeleted: boolean;
  departureAt: Date | null;
  originCity: string | null;
  originCountryCode: string | null;
  originTimezone: string | null;
  destinationCity: string | null;
  destinationCountryCode: string | null;
  destinationTimezone: string | null;
  transportMode: string | null;
  pricePerKgCents: number | null;
  checkedBag23PriceCents: number | null;
  cabinBag12PriceCents: number | null;
  capacityKg: number | null;
  reservedKg: number;
  familyConditions: Array<{ familyKey: string; mode: string; surchargePct: number | null }>;
};

/** A29 — un snapshot parcel garde une `category` legacy : dérivée de la famille. */
export const FAMILY_DEFAULT_CATEGORY: Record<ParcelFamily, string> = {
  DOCUMENTS_PAPERS: "DOCUMENTS",
  CLOTHES_TEXTILE: "CLOTHES",
  FOOD_DRY_SEALED: "OTHER_ACCESSORIES",
  ELECTRONICS_DEVICES: "OTHER_ELECTRONICS",
  COSMETICS_CARE: "OTHER_ACCESSORIES",
  PARTS_TOOLS: "OTHER_ACCESSORIES",
  TOYS_CHILDCARE: "SMALL_TOYS",
  MISC_ACCESSORIES: "OTHER_ACCESSORIES",
};

/* ══ Règles ════════════════════════════════════════════════════ */

/** CAT-03 — REFUSE ⇒ erreur ; SURCHARGE ⇒ % ; ACCEPT/absent ⇒ 0. */
export function resolveFamilySurcharge(trip: TripForBooking, family: ParcelFamily): number {
  const cond = trip.familyConditions.find((c) => c.familyKey === family);
  if (!cond || cond.mode === "ACCEPT") return 0;
  if (cond.mode === "REFUSE") {
    throw new BookingRequestError("FAMILY_REFUSED", "The carrier does not accept this parcel family.", { family });
  }
  return cond.surchargePct ?? 0;
}

/** RG : PUBLISHED, non supprimé, départ futur, pas son propre trajet. */
export function checkTripBookable(trip: TripForBooking, shipperId: string, now: Date): void {
  if (trip.userId === shipperId) {
    throw new BookingRequestError("OWN_TRIP", "You cannot book your own trip.");
  }
  if (trip.isDeleted || trip.status !== "PUBLISHED") {
    throw new BookingRequestError("TRIP_NOT_BOOKABLE", "This trip is not open to requests.");
  }
  if (!trip.departureAt || trip.departureAt.getTime() <= now.getTime()) {
    throw new BookingRequestError("TRIP_NOT_BOOKABLE", "This trip has already departed.");
  }
}

/** Saisie Expéditeur + trajet → entrée du moteur unique (D34). */
export function buildQuoteInput(trip: TripForBooking, input: BookingQuoteInput): QuoteInput {
  return {
    product: input.product,
    pricePerKgCents: trip.pricePerKgCents,
    checkedBag23PriceCents: trip.checkedBag23PriceCents,
    cabinBag12PriceCents: trip.cabinBag12PriceCents,
    weightKg: input.product === "PARCEL" ? input.weightKg ?? null : null,
    sizeClass: input.product === "PARCEL" ? input.sizeClass ?? null : null,
    familySurchargePct: resolveFamilySurcharge(trip, input.family),
    protection: input.protection ?? "BASIC",
  };
}

/** Devis serveur — QuoteError (moteur) remontée telle quelle : le contrôleur la traduit en 400. */
export function quoteForTrip(trip: TripForBooking, input: BookingQuoteInput): ShipperQuote {
  return quoteShipperPrice(buildQuoteInput(trip, input));
}

/** D17 — le total vu par l'Expéditeur DOIT être celui que l'on figera. */
export function assertQuoteMatches(quote: ShipperQuote, expectedTotalCents: number): void {
  if (quote.totalShipperCents !== expectedTotalCents) {
    throw new BookingRequestError(
      "QUOTE_DIVERGENCE",
      "The price changed since you saw it — please review the new total.",
      { expectedTotalCents, actualTotalCents: quote.totalShipperCents }
    );
  }
}

/** CAP-01 — kg à réserver : le poids DÉCLARÉ du colis (le plancher 0,5 kg est une règle de prix, pas de place), la franchise d'un bagage. */
export function kgToReserve(quote: ShipperQuote): number {
  return quote.capacityKgConsumed;
}

export function remainingKg(trip: TripForBooking): number | null {
  if (trip.capacityKg == null) return null;
  return Math.max(0, trip.capacityKg - trip.reservedKg);
}

/**
 * CAP-01 — le WHERE de la réservation atomique (updateMany conditionnel).
 * ⚠️ Pitfall Prisma+Mongo (A34) : `reservedKg: { lte: X }` NE matche PAS un
 * document où le champ est ABSENT (trajet créé avant l'ajout du champ) →
 * faux CAPACITY_EXCEEDED. Aucune défense runtime possible : `isSet` est
 * refusé sur un champ non-nullable, et `NOT: { gt }` ne matche pas non plus
 * les champs absents (vérifié). Le fix est un état de données garanti :
 * `packages/libs/prisma/scripts/backfill-reserved-kg.ts` (idempotent) doit
 * être rejoué sur tout environnement dont des Trips prédatent B2-PR1.
 */
export function capacityReservationWhere(trip: TripForBooking, kg: number) {
  if (trip.capacityKg == null) return { id: trip.id, status: "PUBLISHED" as const };
  return {
    id: trip.id,
    status: "PUBLISHED" as const,
    reservedKg: { lte: trip.capacityKg - kg },
  };
}

/** Vérification en mémoire (la garantie atomique est l'updateMany conditionnel de la transaction). */
export function checkCapacity(trip: TripForBooking, kg: number): void {
  const left = remainingKg(trip);
  if (left != null && kg > left + 1e-9) {
    throw new BookingRequestError("CAPACITY_EXCEEDED", "Not enough remaining capacity on this trip.", {
      requestedKg: kg,
      remainingKg: left,
    });
  }
}

export const ACCEPTANCE_WINDOW_HOURS = 24; // DEA-01

/* ══ Snapshots (D17 : immuables, jamais recalculés) ═══════════ */

export function buildBookingSnapshots(args: {
  trip: TripForBooking;
  input: CreateBookingRequest;
  quote: ShipperQuote;
  now: Date;
}) {
  const { trip, input, quote, now } = args;
  const weightKg =
    quote.weightKg ?? (quote.pricingModel === "FLAT_BAG" ? quote.capacityKgConsumed : 0);

  return {
    trip: {
      originCity: trip.originCity ?? "",
      originCountryCode: trip.originCountryCode,
      originTimezone: trip.originTimezone,
      destinationCity: trip.destinationCity ?? "",
      destinationCountryCode: trip.destinationCountryCode,
      destinationTimezone: trip.destinationTimezone,
      departureAt: trip.departureAt as Date,
      transportMode: trip.transportMode,
    },
    pricing: {
      pricingModel: "PER_KG" as const, // enum Prisma : le bagage forfaitaire est un sous-cas (product)
      weightKg,
      categoryPriceCents: null,
      pricePerKgCents: quote.pricePerKgCents,
      sizeClass: quote.sizeClass,
      transportCents: quote.transportCents,
      commissionPct: quote.commissionPct / 100, // snapshot historique en fraction (seed : 0.12)
      commissionCents: quote.commissionCents,
      protectionProvider: quote.protectionTier === "EXTENDED_500" ? "YAMBA_GUARANTEE" : null,
      protectionTier: quote.protectionTier,
      premiumCents: quote.premiumCents,
      totalShipperCents: quote.totalShipperCents,
      currencyCode: quote.currencyCode,
      product: quote.product,
      billableWeightKg: quote.billableWeightKg,
      sizeCoef: quote.sizeCoef,
      familySurchargePct: quote.familySurchargePct,
      rawTransportCents: quote.rawTransportCents,
      minimumApplied: quote.minimumApplied,
      serviceCents: quote.serviceCents,
    },
    parcel: {
      category:
        input.product === "CHECKED_BAG_23KG"
          ? "CHECKED_BAG_23KG"
          : input.product === "CABIN_BAG_12KG"
            ? "CABIN_BAG_12KG"
            : FAMILY_DEFAULT_CATEGORY[input.family],
      categoryFamily: input.family,
      description: input.description,
      declaredValueCents: input.declaredValueCents,
      photoUrls: input.photoUrls ?? [],
    },
    recipient: {
      firstName: input.recipient.firstName,
      lastName: input.recipient.lastName,
      phoneE164: input.recipient.phoneE164,
      email: input.recipient.email?.trim() || null, // optionnel — jamais de chaîne vide figée
    },
    pickupPlace: input.pickupPlace ? { kind: input.pickupPlace.kind, details: input.pickupPlace.details ?? null } : null,
    deliveryPlace: input.deliveryPlace
      ? { kind: input.deliveryPlace.kind, details: input.deliveryPlace.details ?? null }
      : null,
    requestedAt: now,
    expiresAt: new Date(now.getTime() + ACCEPTANCE_WINDOW_HOURS * 3600 * 1000),
  };
}
