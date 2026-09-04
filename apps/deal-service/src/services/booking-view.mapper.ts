import type {
  ShipperBookingView,
  CarrierBookingView,
  BookingViewerRole,
  TrackingStep,
} from "@packages/api-contracts";
import {
  DISPUTE_AFTER_DEPARTURE_HOURS,
  canRate,
  getAllowedActions,
  MAX_CODE_REGENERATIONS,
  MAX_DELIVERY_ATTEMPTS,
} from "./booking-state-machine";
import {
  computeCancellationRefundCents,
  CANCEL_FULL_REFUND_UNTIL_HOURS,
  CANCEL_LATE_RETENTION_PCT,
} from "./booking-lifecycle";
import { DISPUTE_RESPONSE_DELAY_HOURS, type DisputeResolutionView, type RetentionDecisionView } from "@packages/api-contracts";

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
  /** C-PR2 (D54 4B) — "ADMIN" quand le deal a été clos par médiation : aucune notation. */
  completedBy?: string | null;
  // C-PR2 (D55 3A) — arbitrage d'une retenue
  retentionDecisionReason?: string | null;
  retentionDecidedAt?: Date | null;

  // B4 — absents sur les enregistrements antérieurs
  payoutStatus?: string | null;
  payoutSentAt?: Date | null;
  payoutFailureReason?: string | null;
  deliveryPhotoUrls?: string[] | null;
  payoutAmountCents?: number | null;
  retentionDisposition?: string | null;
  capturedAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
  retentionCents?: number | null;
  // B5
  ratingWindowEndsAt?: Date | null;
  shipperRatedAt?: Date | null;
  carrierRatedAt?: Date | null;
  ratingsRevealedAt?: Date | null;

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
  // C-PR2 (D55) — état de la version du Voyageur et décision (optionnels : anciens appels)
  status?: string | null;
  carrierRespondedAt?: Date | null;
  resolutionOutcome?: string | null;
  resolutionRefundCents?: number | null;
  resolutionCarrierPayoutCents?: number | null;
  resolutionReason?: string | null;
  resolvedAt?: Date | null;
};

/** C-PR2 — la décision telle que les DEUX parties la lisent (issue, montants, motif). */
export function toDisputeResolution(d: DisputeRecord): DisputeResolutionView | null {
  if (!d.resolvedAt || !d.resolutionOutcome) return null;
  return {
    outcome: d.resolutionOutcome as DisputeResolutionView["outcome"],
    refundCents: d.resolutionRefundCents ?? 0,
    carrierPayoutCents: d.resolutionCarrierPayoutCents ?? 0,
    reason: d.resolutionReason ?? "",
    resolvedAt: toIsoRequired(d.resolvedAt),
  };
}

/** C-PR2 (3A) — l'arbitrage d'une retenue, lisible par les deux parties. */
export function toRetentionDecision(b: Pick<BookingRecord, "retentionDisposition" | "retentionDecisionReason" | "retentionDecidedAt">): RetentionDecisionView | null {
  if (!b.retentionDecidedAt || (b.retentionDisposition !== "CARRIER" && b.retentionDisposition !== "SHIPPER")) return null;
  return {
    outcome: b.retentionDisposition === "CARRIER" ? "COMPENSATE_CARRIER" : "RESTITUTE_SHIPPER",
    reason: b.retentionDecisionReason ?? "",
    decidedAt: toIsoRequired(b.retentionDecidedAt),
  };
}

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

/** B5/D53 — l'état de notation pour un rôle (bouton « Noter », « note envoyée », révélé). */
const toRatingState = (b: BookingRecord, role: "SHIPPER" | "CARRIER", now: Date): ShipperBookingView["rating"] => {
  // C-PR2 (D54 4B) — clos par médiation : aucune surface de notation.
  if (b.completedBy === "ADMIN") return null;
  if (b.status !== "COMPLETED") return null;
  const check = canRate(
    { status: "COMPLETED", isDeleted: false, ratingWindowEndsAt: b.ratingWindowEndsAt ?? null, shipperRatedAt: b.shipperRatedAt ?? null, carrierRatedAt: b.carrierRatedAt ?? null },
    role,
    now
  );
  return {
    windowEndsAt: toIso(b.ratingWindowEndsAt ?? null),
    ratedByMe: role === "SHIPPER" ? !!b.shipperRatedAt : !!b.carrierRatedAt,
    counterpartHasRated: role === "SHIPPER" ? !!b.carrierRatedAt : !!b.shipperRatedAt,
    revealedAt: toIso(b.ratingsRevealedAt ?? null),
    canRate: check.allowed,
  };
};

/** A75 — le Voyageur apprend s'il doit agir (compte Stripe) ou attendre (rejeu automatique). */
const toPayoutBlocker = (b: BookingRecord): CarrierBookingView["payoutBlocker"] => {
  if (b.payoutStatus !== "FAILED") return null;
  return b.payoutFailureReason === "CARRIER_ACCOUNT_NOT_READY" ? "ACCOUNT_NOT_READY" : "RETRYING";
};

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
  deliveryPhotoUrls: b.deliveryPhotoUrls ?? [],
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

    // A83 — le sort de l'argent de l'Expéditeur (Finances) ; jamais servi au Voyageur (A13).
    capturedAt: toIso(booking.capturedAt ?? null),
    refundedAt: toIso(booking.refundedAt ?? null),
    refundAmountCents: booking.refundAmountCents ?? null,
    retentionCents: booking.retentionCents ?? null,

    // B5 — état de notation du rôle Expéditeur.
    rating: toRatingState(booking, "SHIPPER", now),

    // A72 — la date d'ouverture du litige « non livré » est SERVIE (jamais calculée par le front).
    disputeOpensAt:
      booking.status === "PICKED_UP"
        ? new Date(booking.trip.departureAt.getTime() + DISPUTE_AFTER_DEPARTURE_HOURS * 3_600_000).toISOString()
        : null,

    // A68 — le dossier n'est servi qu'à l'Expéditeur ; C-PR2 : pendant le litige ET après la décision.
    retentionDecision: toRetentionDecision(booking),
    dispute:
      dispute
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
            carrierRespondedAt: toIso(dispute.carrierRespondedAt ?? null),
            resolution: toDisputeResolution(dispute),
          }
        : null,
  };
}

export function toCarrierBookingView(
  booking: BookingRecord,
  shipper: CounterpartRecord,
  dispute: DisputeRecord | null = null,
  now: Date = new Date()
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
    // B5 — état de notation du rôle Voyageur.
    rating: toRatingState(booking, "CARRIER", now),
    // A75 — cause GROSSIÈRE d'un versement bloqué (jamais le message Stripe).
    payoutBlocker: toPayoutBlocker(booking),
    // D50/A82 — le montant réellement versé (net, ou compensation ANN-01) et le sort de la retenue.
    payoutAmountCents: booking.payoutAmountCents ?? null,
    retentionDisposition: (booking.retentionDisposition as CarrierBookingView["retentionDisposition"]) ?? null,
    // A68 — la catégorie seule (jamais la description ni les photos).
    disputeCategory:
      dispute && booking.status === "DISPUTED"
        ? (dispute.category as CarrierBookingView["disputeCategory"])
        : null,
    // C-PR2 (D55) — sa version (état), l'échéance, la décision ; jamais le dossier de l'Expéditeur.
    dispute:
      dispute && booking.disputedAt
        ? {
            ticketNumber: dispute.ticketNumber,
            category: dispute.category as NonNullable<CarrierBookingView["dispute"]>["category"],
            disputedAt: toIsoRequired(booking.disputedAt),
            canRespond: booking.status === "DISPUTED" && !dispute.carrierRespondedAt && !dispute.resolvedAt,
            responseDeadlineAt: new Date(booking.disputedAt.getTime() + DISPUTE_RESPONSE_DELAY_HOURS * 3_600_000).toISOString(),
            respondedAt: toIso(dispute.carrierRespondedAt ?? null),
            resolution: toDisputeResolution(dispute),
          }
        : null,
    retentionDecision: toRetentionDecision(booking),
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
