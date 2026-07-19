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
