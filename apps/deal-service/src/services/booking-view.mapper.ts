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
import {
  computeCancellationRefundCents,
  CANCEL_FULL_REFUND_UNTIL_HOURS,
  CANCEL_LATE_RETENTION_PCT,
} from "./booking-lifecycle";

/**
 * booking-view.mapper.ts
 * ======================
 * Construction des DTOs PAR RÔLE (A13) — LISTE BLANCHE stricte :
 * chaque champ est posé explicitement, jamais de spread du document
 * Prisma. C'est la frontière de sécurité de la lecture :
 *   - `deliveryCodeHash` et `deliveryCodeEncrypted` ne sont LUS par aucun mapper ;
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
    email: string | null;
  };
  pickup: {
    confirmedAt: Date;
    photoUrls: string[];
    notes: string | null;
    checklist?: string[]; // B3 — absent sur les enregistrements antérieurs
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
  pickupRefusalReason?: string | null; // B3/A40

  codeRegenerations: number;
  deliveryAttempts: number;
  deliveryLockedUntil: Date | null;

  disputeTicket: string | null;
  disputedAt: Date | null;

  // B4 — absents sur les enregistrements antérieurs
  payoutStatus?: string | null;
  payoutSentAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

/** Dossier de litige (B4/D51) — chargé par le contrôleur quand le deal est DISPUTED. */
export type DisputeRecord = {
  ticketNumber: string;
  category: string;
  description: string;
  desiredOutcome: string | null;
  photoUrls: string[];
  createdAt: Date;
};

/** Contrepartie chargée par le controller (jointure explicite). */
export type CounterpartRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  publicSlug?: string | null; // A45 — lien « Voir profil » (/u/[slug])
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
  publicSlug: u.publicSlug ?? null,
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
      checklist: p.checklist ?? [],
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
  pickupRefusalReason: b.pickupRefusalReason ?? null,
  disputeTicket: b.disputeTicket,
  disputedAt: toIso(b.disputedAt),
  payoutStatus: (b.payoutStatus as ShipperBookingView["payoutStatus"]) ?? null,
  payoutSentAt: toIso(b.payoutSentAt ?? null),
  createdAt: toIsoRequired(b.createdAt),
  updatedAt: toIsoRequired(b.updatedAt),
});

/** ANN-01 servie au front (« le front reflète, ne décide jamais ») —
 *  non nulle exactement quand `cancel` est permis. PENDING : libération
 *  intégrale de l'empreinte ; ACCEPTED : barème au moment de la lecture.
 *  Informatif : le montant réel est RECALCULÉ au cancel effectif. */
const toCancellationPreview = (
  b: BookingRecord,
  allowed: readonly string[],
  now: Date
): ShipperBookingView["cancellationPreview"] => {
  if (!allowed.includes("cancel")) return null;
  const total = b.pricing.totalShipperCents;
  const refundCents =
    b.status === "ACCEPTED"
      ? computeCancellationRefundCents({
        totalShipperCents: total,
        departureAt: b.trip.departureAt,
        now,
      })
      : total;
  return {
    refundCents,
    retentionCents: total - refundCents,
    retentionPct: CANCEL_LATE_RETENTION_PCT,
    fullRefundUntil: new Date(
      b.trip.departureAt.getTime() - CANCEL_FULL_REFUND_UNTIL_HOURS * 3_600_000
    ).toISOString(),
    currencyCode: b.pricing.currencyCode,
  };
};

/* ══ Vues par rôle ════════════════════════════════════════════ */

/**
 * `deliveryCode` : le code EN CLAIR, déchiffré par l'appelant
 * (`revealDeliveryCode`, lib/delivery-code.ts — D43) pour la seule vue
 * Shipper de GET /deals/:id ; les listes passent null. Le mapper reste
 * pur (aucune clé, aucun env) et ne lit JAMAIS deliveryCodeEncrypted.
 */
export function toShipperBookingView(
  booking: BookingRecord,
  carrier: CounterpartRecord,
  now: Date = new Date(),
  deliveryCode: string | null = null,
  dispute: DisputeRecord | null = null
): ShipperBookingView {
  const allowedActions = getAllowedActions(
    { ...booking, departureAt: booking.trip.departureAt } as Parameters<typeof getAllowedActions>[0],
    "SHIPPER"
  );
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

    // D43 : révélé en PICKED_UP seulement, jamais en liste (paramètre).
    deliveryCode,
    codeRegenerationsLeft: Math.max(
      0,
      MAX_CODE_REGENERATIONS - booking.codeRegenerations
    ),

    pickup: toPickup(booking.pickup),
    trackingEvents: toTrackingEvents(booking.trackingEvents),

    allowedActions,
    cancellationPreview: toCancellationPreview(booking, allowedActions, now),

    // A68 — le dossier n'est servi qu'à l'Expéditeur, et seulement en DISPUTED.
    dispute:
      dispute && booking.status === "DISPUTED"
        ? {
            ticketNumber: dispute.ticketNumber,
            category: dispute.category as ShipperBookingView["dispute"] extends infer D
              ? D extends { category: infer C }
                ? C
                : never
              : never,
            description: dispute.description,
            desiredOutcome: (dispute.desiredOutcome as NonNullable<ShipperBookingView["dispute"]>["desiredOutcome"]) ?? null,
            photoUrls: dispute.photoUrls,
            createdAt: toIsoRequired(dispute.createdAt),
          }
        : null,
  };
}

export function toCarrierBookingView(
  booking: BookingRecord,
  shipper: CounterpartRecord,
  dispute: DisputeRecord | null = null
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
      { ...booking, departureAt: booking.trip.departureAt } as Parameters<typeof getAllowedActions>[0],
      "CARRIER"
    ),
    // A68 — la catégorie seule (jamais la description ni les photos).
    disputeCategory:
      dispute && booking.status === "DISPUTED"
        ? (dispute.category as CarrierBookingView["disputeCategory"])
        : null,
  };
}

/** Dispatch par rôle — utilisé par GET /deals/:id. */
export function toBookingView(
  booking: BookingRecord,
  role: BookingViewerRole,
  counterpart: CounterpartRecord,
  deliveryCode: string | null = null,
  dispute: DisputeRecord | null = null
): ShipperBookingView | CarrierBookingView {
  return role === "SHIPPER"
    ? toShipperBookingView(booking, counterpart, new Date(), deliveryCode, dispute)
    : toCarrierBookingView(booking, counterpart, dispute);
}
