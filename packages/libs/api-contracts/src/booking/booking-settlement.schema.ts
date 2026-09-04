/**
 * booking-settlement.schema.ts — B4 « argent sortant » : confirmation anticipée, litige
 * =====================================================================================
 * Emplacement : packages/libs/api-contracts/src/booking/booking-settlement.schema.ts
 *
 * Contrats de `POST /deals/:id/confirm` (Expéditeur, DELIVERED → COMPLETED,
 * INV-3 : définitif) et `POST /deals/:id/dispute` (Expéditeur, DELIVERED →
 * DISPUTED avant J+4, INV-4 : irréversible). Le versement lui-même n'a pas
 * de route : il est exécuté par le serveur (D49) et se lit dans
 * `payoutStatus` des vues.
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { DisputeCategorySchema, DisputeDesiredOutcomeSchema, PayoutStatusSchema } from "./booking.enums";

/* ══ Paramètres serveur (spec §3.6) ═══════════════════════════ */

export const DISPUTE_MIN_DESCRIPTION_LENGTH = 50;
export const DISPUTE_MAX_DESCRIPTION_LENGTH = 2000;
export const DISPUTE_PHOTOS_MAX = 5;

/* ══ Confirmation anticipée ═══════════════════════════════════ */

export const ConfirmDealResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: z.literal("COMPLETED"),
    completedAt: z.iso.datetime(),
    payoutStatus: PayoutStatusSchema.meta({
      description: "SENT if the transfer succeeded inline, FAILED if the provider refused (retried by the cron — A67)",
    }),
    payoutAmountCents: z.number().int().meta({ description: "= pricing.transportCents (carrier net, D50)" }),
    currencyCode: z.string(),
  })
  .meta({ id: "ConfirmDealResponse", description: "Early confirmation done — payout released (INV-3: final)" });
export type ConfirmDealResponse = z.infer<typeof ConfirmDealResponseSchema>;

/* ══ Litige ═══════════════════════════════════════════════════ */

export const DisputeDealRequestSchema = z
  .object({
    category: DisputeCategorySchema,
    description: z
      .string()
      .trim()
      .min(DISPUTE_MIN_DESCRIPTION_LENGTH, `Description must be at least ${DISPUTE_MIN_DESCRIPTION_LENGTH} characters`)
      .max(DISPUTE_MAX_DESCRIPTION_LENGTH),
    pledgeAccepted: z.literal(true).meta({ description: "Honour pledge — must be true (anti-abuse, spec §3.6)" }),
    photoUrls: z
      .array(z.url())
      .max(DISPUTE_PHOTOS_MAX, `At most ${DISPUTE_PHOTOS_MAX} photos`)
      .default([])
      .meta({ description: "ImageKit URLs (direct signed upload — D42), optional but recommended" }),
    desiredOutcome: DisputeDesiredOutcomeSchema.optional(),
  })
  .meta({ id: "DisputeDealRequest", description: "Open a dispute (shipper, DELIVERED, before payoutDueAt)" });
export type DisputeDealRequest = z.infer<typeof DisputeDealRequestSchema>;

export const DisputeDealResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: z.literal("DISPUTED"),
    ticketNumber: z.string().meta({ example: "YAM-2041" }),
    disputedAt: z.iso.datetime(),
  })
  .meta({ id: "DisputeDealResponse", description: "Dispute opened — payout frozen, ticket issued (INV-4/INV-5)" });
export type DisputeDealResponse = z.infer<typeof DisputeDealResponseSchema>;

/** Dossier de litige servi à l'Expéditeur seul (A68) dans `GET /deals/:id`. */

/* ══ C-PR2 (D55) — version du Voyageur, résolution, arbitrage de retenue ══ */

/** Délai laissé au Voyageur pour donner sa version avant qu'une décision soit possible (1A). */
export const DISPUTE_RESPONSE_DELAY_HOURS = 72;

export const DisputeResolutionOutcomeSchema = z
  .enum(["REJECTED", "PARTIAL_REFUND", "FULL_REFUND"])
  .meta({ id: "DisputeResolutionOutcome", description: "REJECTED: carrier paid in full · PARTIAL_REFUND: free amount · FULL_REFUND: shipper refunded everything (D54 3A)" });
export type DisputeResolutionOutcome = z.infer<typeof DisputeResolutionOutcomeSchema>;

export const RetentionArbitrationOutcomeSchema = z
  .enum(["COMPENSATE_CARRIER", "RESTITUTE_SHIPPER"])
  .meta({ id: "RetentionArbitrationOutcome", description: "Late cancellation after departure (A81): retention goes to the carrier (pro-rata A79) or back to the shipper" });
export type RetentionArbitrationOutcome = z.infer<typeof RetentionArbitrationOutcomeSchema>;

export const DisputeResolutionViewSchema = z
  .object({
    outcome: DisputeResolutionOutcomeSchema,
    refundCents: z.number().int().meta({ description: "Refunded to the shipper" }),
    carrierPayoutCents: z.number().int().meta({ description: "Paid out to the carrier (net − refund, floor 0)" }),
    reason: z.string().meta({ description: "Admin's written reason — read by BOTH parties" }),
    resolvedAt: z.iso.datetime(),
  })
  .meta({ id: "DisputeResolutionView" });
export type DisputeResolutionView = z.infer<typeof DisputeResolutionViewSchema>;

export const CarrierDisputeStatementRequestSchema = z
  .object({
    statement: z
      .string()
      .trim()
      .min(DISPUTE_MIN_DESCRIPTION_LENGTH, `Statement must be at least ${DISPUTE_MIN_DESCRIPTION_LENGTH} characters`)
      .max(DISPUTE_MAX_DESCRIPTION_LENGTH),
    photoUrls: z.array(z.url()).max(DISPUTE_PHOTOS_MAX, `At most ${DISPUTE_PHOTOS_MAX} photos`).default([]),
  })
  .meta({ id: "CarrierDisputeStatementRequest", description: "The carrier's side of the story — once, while the dispute is open (D55 1A)" });
export type CarrierDisputeStatementRequest = z.infer<typeof CarrierDisputeStatementRequestSchema>;

export const CarrierDisputeStatementResponseSchema = z
  .object({ bookingId: ObjectIdSchema, ticketNumber: z.string(), respondedAt: z.iso.datetime() })
  .meta({ id: "CarrierDisputeStatementResponse" });
export type CarrierDisputeStatementResponse = z.infer<typeof CarrierDisputeStatementResponseSchema>;

export const CarrierDisputeViewSchema = z
  .object({
    ticketNumber: z.string(),
    category: DisputeCategorySchema,
    disputedAt: z.iso.datetime(),
    canRespond: z.boolean().meta({ description: "DISPUTED, no statement yet — the front reflects, never decides" }),
    responseDeadlineAt: z.iso.datetime().meta({ description: "disputedAt + 72h: after that the admin may decide without the carrier's statement" }),
    respondedAt: z.iso.datetime().nullable(),
    resolution: DisputeResolutionViewSchema.nullable(),
  })
  .meta({ id: "CarrierDisputeView", description: "What the carrier sees of a dispute: ticket, category, its own statement state, the decision — never the shipper's file (A68)" });
export type CarrierDisputeView = z.infer<typeof CarrierDisputeViewSchema>;

export const RetentionDecisionViewSchema = z
  .object({ outcome: RetentionArbitrationOutcomeSchema, reason: z.string(), decidedAt: z.iso.datetime() })
  .meta({ id: "RetentionDecisionView" });
export type RetentionDecisionView = z.infer<typeof RetentionDecisionViewSchema>;

export const ShipperDisputeViewSchema = z
  .object({
    ticketNumber: z.string(),
    category: DisputeCategorySchema,
    description: z.string(),
    desiredOutcome: DisputeDesiredOutcomeSchema.nullable(),
    photoUrls: z.array(z.string()),
    createdAt: z.iso.datetime(),
    carrierRespondedAt: z.iso.datetime().nullable().meta({ description: "The carrier gave their side (content never served to the shipper — D55 5A)" }),
    resolution: DisputeResolutionViewSchema.nullable(),
  })
  .meta({ id: "ShipperDisputeView", description: "The dispute file as filed by the shipper (never served to the carrier)" });
export type ShipperDisputeView = z.infer<typeof ShipperDisputeViewSchema>;
