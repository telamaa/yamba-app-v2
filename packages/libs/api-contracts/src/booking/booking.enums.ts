import { z } from "zod";

/**
 * @packages/api-contracts — booking enums
 * =======================================
 * Miroirs 1:1 des enums Prisma (schema.prisma) de la surface deal,
 * + les ensembles ACTIF/TERMINAL/BLOQUANT-COMPLÉTION (A19) :
 * source UNIQUE importée à la fois par la booking-state-machine
 * (deal-service) et par trip-service (hasActiveBookings /
 * hasBookingsInProgress — A20). Ne jamais recopier ces listes.
 *
 * ⚠️ Source de vérité : schema.prisma. Toute divergence est un bug.
 */

/* ══ Enums Prisma ═════════════════════════════════════════════ */

export const BookingStatusSchema = z
  .enum([
    "PENDING",
    "ACCEPTED",
    "PICKED_UP",
    "DELIVERED",
    "COMPLETED",
    "DECLINED",
    "EXPIRED",
    "CANCELLED",
    "DISPUTED",
  ])
  .meta({ id: "BookingStatus" });
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingActorSchema = z
  .enum(["SHIPPER", "CARRIER", "SYSTEM", "ADMIN"])
  .meta({ id: "BookingActor" });
export type BookingActor = z.infer<typeof BookingActorSchema>;

/** Rôles pouvant CONSULTER un deal (les vues par rôle, PR3). */
export const BookingViewerRoleSchema = z
  .enum(["SHIPPER", "CARRIER"])
  .meta({
    id: "BookingViewerRole",
    description: "Role of the authenticated viewer for a deal (drives the DTO shape)",
  });
export type BookingViewerRole = z.infer<typeof BookingViewerRoleSchema>;

export const PricingModelSchema = z
  .enum(["PER_CATEGORY", "PER_KG"])
  .meta({
    id: "PricingModel",
    description:
      "Pricing engine at booking creation time. PER_CATEGORY = current flat price per category; PER_KG = D13 target (price/kg x S/M/L size class). Snapshots are never migrated.",
  });
export type PricingModel = z.infer<typeof PricingModelSchema>;

/* ══ State machine (booking.lifecycle) ════════════════════════ */

export const BookingTransitionActionSchema = z
  .enum([
    "accept",
    "decline",
    "expire",
    "cancel",
    "pickup",
    "refusePickup",
    "deliver",
    "confirmEarly",
    "autoComplete",
    "dispute",
  ])
  .meta({
    id: "BookingTransitionAction",
    description:
      "Actions of the booking state machine (canPerform/getAllowedActions). Returned in allowedActions to drive frontend CTAs — the frontend reflects, never decides.",
  });
export type BookingTransitionAction = z.infer<typeof BookingTransitionActionSchema>;

/** Séquence stricte des jalons de tracking (dans PICKED_UP, hors machine — A7). */
export const TrackingStepSchema = z
  .enum(["AT_AIRPORT", "FLIGHT_DEPARTED", "FLIGHT_ARRIVED"])
  .meta({
    id: "TrackingStep",
    description: "Optional tracking milestones inside PICKED_UP, strictly sequential",
  });
export type TrackingStep = z.infer<typeof TrackingStepSchema>;

/* ══ Ensembles partagés (A19 — source unique) ═════════════════ */

/**
 * Statuts "actifs" : conservent les kg réservés (CAP-02) et bloquent
 * edit/unpublish côté trip. DISPUTED est ACTIF (le litige conserve
 * les kg) — voir BOOKING_COMPLETION_BLOCKING_STATUSES pour la nuance.
 */
export const BOOKING_ACTIVE_STATUSES: readonly BookingStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
  "DISPUTED",
] as const;

/** Statuts terminaux : libèrent les kg (CAP-02). */
export const BOOKING_TERMINAL_STATUSES: readonly BookingStatus[] = [
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

/**
 * A20 — statuts bloquant la COMPLÉTION du trip (cron complete-trips).
 * Position gravée : DISPUTED ne bloque PAS la complétion (le voyage
 * physique est fini) mais conserve les kg. D'où : ACTIFS − DISPUTED.
 * Consommé par trip-service via ctx.hasBookingsInProgress.
 */
export const BOOKING_COMPLETION_BLOCKING_STATUSES: readonly BookingStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
] as const;

/* ══ B4 — versement et litige (D49, D51) ═════════════════════ */

/** Versement au Voyageur : INV-2 (rien avant COMPLETED), INV-5 (FROZEN sur litige). */
export const PayoutStatusSchema = z
  .enum(["PENDING", "SENT", "FAILED", "FROZEN", "REVERSED"])
  .meta({
    id: "PayoutStatus",
    description:
      "Carrier payout state (B4/D49). PENDING = deal COMPLETED, transfer not yet executed · SENT = transfer executed " +
      "(payoutSentAt) · FAILED = transfer refused (retried by the payout cron) · FROZEN = dispute open (INV-5) · " +
      "REVERSED = Stripe reversed the transfer (never re-sent automatically — admin, A87). null before COMPLETED / DISPUTED.",
  });
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

export const DISPUTE_CATEGORIES = [
  "NOT_DELIVERED",
  "CONTENT_MISSING",
  "DAMAGED",
  "SIGNIFICANT_DELAY",
  "RECIPIENT_ISSUE",
  "OTHER",
] as const;
export const DisputeCategorySchema = z
  .enum(DISPUTE_CATEGORIES)
  .meta({ id: "DisputeCategory", description: "Dispute category (spec §3.6 — one of six)" });
export type DisputeCategory = z.infer<typeof DisputeCategorySchema>;

export const DISPUTE_DESIRED_OUTCOMES = ["FULL_REFUND", "PARTIAL_REFUND", "CONTACT_CARRIER", "YAMBA_DECIDES"] as const;
export const DisputeDesiredOutcomeSchema = z
  .enum(DISPUTE_DESIRED_OUTCOMES)
  .meta({ id: "DisputeDesiredOutcome", description: "What the shipper asks for (optional, informs mediation)" });
export type DisputeDesiredOutcome = z.infer<typeof DisputeDesiredOutcomeSchema>;
