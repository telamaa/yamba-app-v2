import type {
  ShipperBookingView,
  CarrierBookingView,
  BookingViewerRole,
  TrackingStep,
} from "@packages/api-contracts";
import {
  getAllowedActions,
  MAX_CODE_REGENERATIONS,
  MAX_DELIVERY_ATTEMPTS,
} from "./booking-state-machine";

/**
 * booking-view.mapper.ts
 * ======================
 * Construction des DTOs PAR RÔLE (A13) — LISTE BLANCHE stricte :
 * chaque champ est posé explicitement, jamais de spread du document
 * Prisma. C'est la frontière de sécurité de la lecture :
 *   - `deliveryCodeHash` n'est LU par aucun mapper (il n'existe pas ici) ;
 *   - le code n'apparaît que côté Shipper (null en B1 — B2 ajoutera
 *     deliveryCodeEncrypted pour le ré-affichage) ;
 *   - le Carrier ne voit ni compteur de régénérations, ni commission,
 *     ni total Expéditeur.
 *
 * Emplacement : apps/deal-service/src/services/booking-view.mapper.ts
 *
 * Design (pattern machine) : types STRUCTURELS, zéro import Prisma —
 * le mapper est testable unitairement (lot 4) avec des objets nus.
 * Les documents Prisma satisfont BookingRecord par typage structurel.
 */

/* ══ Types d'entrée structurels ═══════════════════════════════ */

export type BookingRecord = {
  id: string;
  tripId: string;
  shipperId: string;
  carrierId: string;
  status: string;
  isDeleted?: boolean | null;

  trip: {
    originCity: string;
    originCountryCode: string | null;
    originTimezone: string | null;
    destinationCity: string;
    destinationCountryCode: string | null;
    destinationTimezone: string | null;
    departureAt: Date;
    transportMode: string | null;
  };
  pricing: {
    pricingModel: string;
    weightKg: number;
    categoryPriceCents: number | null;
    pricePerKgCents: number | null;
    sizeClass: string | null;
    transportCents: number;
    commissionPct: number;
    commissionCents: number;
    protectionProvider: string | null;
    protectionTier: string | null;
    premiumCents: number;
    totalShipperCents: number;
    currencyCode: string;
    // D34 (B2) — absents sur les snapshots antérieurs
    product?: string | null;
    billableWeightKg?: number | null;
    sizeCoef?: number | null;
    familySurchargePct?: number | null;
    rawTransportCents?: number | null;
    minimumApplied?: boolean | null;
    serviceCents?: number | null;
  };
  pickupPlace?: { kind: string; details: string | null } | null;
  deliveryPlace?: { kind: string; details: string | null } | null;
  parcel: {
    category: string;
    categoryFamily: string | null;
    description: string;
    declaredValueCents: number;
    photoUrls: string[];
  };
  recipient: {
    firstName: string;
    lastName: string;
    phoneE164: string;
    email: string;
  };
  pickup: {
    confirmedAt: Date;
    photoUrls: string[];
    notes: string | null;
  } | null;
  trackingEvents: { step: string; confirmedAt: Date }[];

  requestedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  payoutDueAt: Date | null;
  completedAt: Date | null;
  closedAt: Date | null;
  closedBy: string | null;
  declineReason: string | null;

  codeRegenerations: number;
  deliveryAttempts: number;
  deliveryLockedUntil: Date | null;

  disputeTicket: string | null;
  disputedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

/** Contrepartie chargée par le controller (jointure explicite). */
export type CounterpartRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

/* ══ Helpers ══════════════════════════════════════════════════ */

const toIso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

const toIsoRequired = (d: Date): string => d.toISOString();

/** Privacy (pattern PublicTripper) : initiale du nom, '' si absent. */
const toCounterpart = (u: CounterpartRecord) => ({
  id: u.id,
  firstName: u.firstName ?? null,
  lastInitial: u.lastName?.trim().charAt(0).toUpperCase() ?? "",
  avatarUrl: u.avatarUrl,
});

const toPlace = (
  p: { kind: string; details: string | null } | null | undefined
): { kind: "AIRPORT" | "TRAIN_STATION" | "CITY_AREA"; details: string | null } | null =>
  p ? { kind: p.kind as "AIRPORT" | "TRAIN_STATION" | "CITY_AREA", details: p.details ?? null } : null;

const toTripSnapshot = (t: BookingRecord["trip"]) => ({
  originCity: t.originCity,
  originCountryCode: t.originCountryCode,
  originTimezone: t.originTimezone,
  destinationCity: t.destinationCity,
  destinationCountryCode: t.destinationCountryCode,
  destinationTimezone: t.destinationTimezone,
  departureAt: toIsoRequired(t.departureAt),
  transportMode: t.transportMode,
});

const toParcelSnapshot = (p: BookingRecord["parcel"]) => ({
  category: p.category as ShipperBookingView["parcel"]["category"],
  categoryFamily: p.categoryFamily,
  description: p.description,
  declaredValueCents: p.declaredValueCents,
  photoUrls: p.photoUrls,
});

const toPickup = (p: BookingRecord["pickup"]) =>
  p
    ? {
      confirmedAt: toIsoRequired(p.confirmedAt),
      photoUrls: p.photoUrls,
      notes: p.notes,
    }
    : null;

const toTrackingEvents = (events: BookingRecord["trackingEvents"]) =>
  events.map((e) => ({
    // Le step est validé à l'écriture (séquenceur B3) — cast sûr en lecture.
    step: e.step as TrackingStep,
    confirmedAt: toIsoRequired(e.confirmedAt),
  }));

/** Jalons communs aux deux vues. */
const toMilestones = (b: BookingRecord) => ({
  requestedAt: toIsoRequired(b.requestedAt),
  expiresAt: toIsoRequired(b.expiresAt),
  acceptedAt: toIso(b.acceptedAt),
  pickedUpAt: toIso(b.pickedUpAt),
  deliveredAt: toIso(b.deliveredAt),
  payoutDueAt: toIso(b.payoutDueAt),
  completedAt: toIso(b.completedAt),
  closedAt: toIso(b.closedAt),
  closedBy: (b.closedBy as ShipperBookingView["closedBy"]) ?? null,
  declineReason: b.declineReason,
  disputeTicket: b.disputeTicket,
  disputedAt: toIso(b.disputedAt),
  createdAt: toIsoRequired(b.createdAt),
  updatedAt: toIsoRequired(b.updatedAt),
});

/* ══ Vues par rôle ════════════════════════════════════════════ */

export function toShipperBookingView(
  booking: BookingRecord,
  carrier: CounterpartRecord
): ShipperBookingView {
  return {
    id: booking.id,
    tripId: booking.tripId,
    carrierId: booking.carrierId,
    status: booking.status as ShipperBookingView["status"],

    trip: toTripSnapshot(booking.trip),
    // Vue Shipper : pricing COMPLET (ce qu'elle a payé, décomposé).
    pricing: {
      pricingModel: booking.pricing.pricingModel as ShipperBookingView["pricing"]["pricingModel"],
      weightKg: booking.pricing.weightKg,
      categoryPriceCents: booking.pricing.categoryPriceCents,
      pricePerKgCents: booking.pricing.pricePerKgCents,
      sizeClass: booking.pricing.sizeClass,
      transportCents: booking.pricing.transportCents,
      commissionPct: booking.pricing.commissionPct,
      commissionCents: booking.pricing.commissionCents,
      protectionProvider: booking.pricing.protectionProvider,
      protectionTier: booking.pricing.protectionTier,
      premiumCents: booking.pricing.premiumCents,
      totalShipperCents: booking.pricing.totalShipperCents,
      currencyCode: booking.pricing.currencyCode,
      product: booking.pricing.product ?? null,
      billableWeightKg: booking.pricing.billableWeightKg ?? null,
      sizeCoef: booking.pricing.sizeCoef ?? null,
      familySurchargePct: booking.pricing.familySurchargePct ?? null,
      rawTransportCents: booking.pricing.rawTransportCents ?? null,
      minimumApplied: booking.pricing.minimumApplied ?? null,
      serviceCents: booking.pricing.serviceCents ?? null,
    },
    parcel: toParcelSnapshot(booking.parcel),
    recipient: booking.recipient,
    pickupPlace: toPlace(booking.pickupPlace),
    deliveryPlace: toPlace(booking.deliveryPlace),
    carrier: toCounterpart(carrier),

    ...toMilestones(booking),

    // B1 : pas de stockage ré-affichable (bcrypt seul) — B2 ajoute
    // deliveryCodeEncrypted (AES-256-GCM) et ce null devient le code.
    deliveryCode: null,
    codeRegenerationsLeft: Math.max(
      0,
      MAX_CODE_REGENERATIONS - booking.codeRegenerations
    ),

    pickup: toPickup(booking.pickup),
    trackingEvents: toTrackingEvents(booking.trackingEvents),

    allowedActions: getAllowedActions(
      booking as Parameters<typeof getAllowedActions>[0],
      "SHIPPER"
    ),
  };
}

export function toCarrierBookingView(
  booking: BookingRecord,
  shipper: CounterpartRecord
): CarrierBookingView {
  return {
    id: booking.id,
    tripId: booking.tripId,
    shipperId: booking.shipperId,
    status: booking.status as CarrierBookingView["status"],

    trip: toTripSnapshot(booking.trip),
    // Vue Carrier : GAINS uniquement — ni commission ni total Shipper.
    pricing: {
      pricingModel: booking.pricing.pricingModel as CarrierBookingView["pricing"]["pricingModel"],
      weightKg: booking.pricing.weightKg,
      categoryPriceCents: booking.pricing.categoryPriceCents,
      pricePerKgCents: booking.pricing.pricePerKgCents,
      sizeClass: booking.pricing.sizeClass,
      transportCents: booking.pricing.transportCents,
      currencyCode: booking.pricing.currencyCode,
    },
    parcel: toParcelSnapshot(booking.parcel),
    // Le destinataire est visible côté Carrier : il en a besoin pour livrer.
    recipient: booking.recipient,
    pickupPlace: toPlace(booking.pickupPlace),
    deliveryPlace: toPlace(booking.deliveryPlace),
    shipper: toCounterpart(shipper),

    ...toMilestones(booking),

    // Jamais de code, jamais de hash, jamais de compteur de régénérations.
    deliveryAttemptsLeft: Math.max(
      0,
      MAX_DELIVERY_ATTEMPTS - booking.deliveryAttempts
    ),
    deliveryLockedUntil: toIso(booking.deliveryLockedUntil),

    pickup: toPickup(booking.pickup),
    trackingEvents: toTrackingEvents(booking.trackingEvents),

    allowedActions: getAllowedActions(
      booking as Parameters<typeof getAllowedActions>[0],
      "CARRIER"
    ),
  };
}

/** Dispatch par rôle — utilisé par GET /deals/:id. */
export function toBookingView(
  booking: BookingRecord,
  role: BookingViewerRole,
  counterpart: CounterpartRecord
): ShipperBookingView | CarrierBookingView {
  return role === "SHIPPER"
    ? toShipperBookingView(booking, counterpart)
    : toCarrierBookingView(booking, counterpart);
}
