/**
 * booking-lifecycle.schema.ts — contrats d'ÉCRITURE des transitions (B2-PR2)
 * ==========================================================================
 * Trois endpoints, tous adossés à la booking-state-machine (jamais une
 * décision dans un controller) :
 *   - POST /deals/:id/accept  — Voyageur, charte cochée, gate D31 (profil +
 *     Stripe) vérifié ICI (plus à la publication), puis CAPTURE (D39).
 *   - POST /deals/:id/decline — Voyageur, raison optionnelle parmi 5 (É2),
 *     libération de l'empreinte + kg restitués (CAP-02).
 *   - POST /deals/:id/cancel  — Expéditeur : PENDING = libération intégrale ;
 *     ACCEPTED = remboursement ANN-01 (100 % jusqu'à J-2, retenue 50 % — D39).
 *
 * Le webhook Stripe (D40) n'a pas de contrat ici : son payload appartient
 * à Stripe (vérifié par signature), il n'entre pas dans l'OpenAPI métier.
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { BookingStatusSchema } from "./booking.enums";

/** É2 — les 5 raisons de refus d'une demande PENDING (analytics du refus). */
export const DeclineReasonSchema = z
  .enum(["CATEGORY_NOT_CARRIED", "TOO_HEAVY", "PLACES_INCOMPATIBLE", "TIMING", "OTHER"])
  .meta({
    id: "DeclineReason",
    description: "The 5 optional decline reasons offered to the carrier (spec É2)",
  });
export type DeclineReason = z.infer<typeof DeclineReasonSchema>;

export const AcceptDealRequestSchema = z
  .object({
    charterAccepted: z
      .literal(true)
      .meta({ description: "Carrier charter (verification, forbidden items, punctuality) — must be true (RGP-03)" }),
  })
  .meta({ id: "AcceptDealRequest" });
export type AcceptDealRequest = z.infer<typeof AcceptDealRequestSchema>;

export const DeclineDealRequestSchema = z
  .object({
    reason: DeclineReasonSchema.nullish().meta({ description: "Optional — one of 5 (spec É2)" }),
  })
  .meta({ id: "DeclineDealRequest" });
export type DeclineDealRequest = z.infer<typeof DeclineDealRequestSchema>;

export const CancelDealRequestSchema = z
  .object({
    reason: z.string().trim().max(300).nullish(),
  })
  .meta({ id: "CancelDealRequest" });
export type CancelDealRequest = z.infer<typeof CancelDealRequestSchema>;

export const DealTransitionResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: BookingStatusSchema,
    refundAmountCents: z
      .number()
      .int()
      .nullable()
      .meta({
        description:
          "Amount returned to the shipper (cents). Full total on PENDING closures (authorization released), " +
          "ANN-01 amount on post-acceptance cancellation, null when nothing is returned (accept).",
      }),
    currencyCode: z.string(),
  })
  .meta({ id: "DealTransitionResponse" });
export type DealTransitionResponse = z.infer<typeof DealTransitionResponseSchema>;

/** Codes 409 des transitions — le front traduit (complète BOOKING_REQUEST_ERROR_CODES). */
export const BOOKING_LIFECYCLE_ERROR_CODES = [
  "TRANSITION_NOT_ALLOWED", // la machine a dit non (statut, rôle, guard) — details.reason
  "CARRIER_ONBOARDING_REQUIRED", // gate D31 : profil incomplet ou Stripe non configuré
  "PAYMENT_STATE_CONFLICT", // l'état chez le fournisseur ne permet pas l'opération (capture/cancel/refund)
  // B3 — transport (booking-transport.schema.ts)
  "DELIVERY_CODE_INVALID", // mauvais code — details.attemptsLeft (A38)
  "DELIVERY_LOCKED", // 3 échecs → verrou 15 min — details.lockedUntil (A38)
  "DELIVERY_CODE_UNAVAILABLE", // PICKED_UP sans hash (enregistrement antérieur à B3)
  "TRACKING_STEP_NOT_ALLOWED", // séquence stricte AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED (A39)
  "CODE_REGENERATION_LIMIT", // plafond MAX_CODE_REGENERATIONS (5) atteint, ou hors PICKED_UP
] as const;
export type BookingLifecycleErrorCode = (typeof BOOKING_LIFECYCLE_ERROR_CODES)[number];
