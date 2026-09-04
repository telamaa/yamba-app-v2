/**
 * admin-dispute.schema.ts — file « à arbitrer » et dossier de médiation (chantier C, D54)
 * =======================================================================================
 * Vue ADMIN d'un deal en attente d'arbitrage : litige OPEN (DISPUTED) ou retenue
 * « à arbitrer » (CANCELLED après le départ sans prise en charge, A81).
 * Whitelist stricte : le dossier sert les preuves des deux côtés (photos de
 * déclaration, de prise en charge, de remise, de litige), jamais le code de
 * livraison (ni hash, ni chiffré — D43), jamais les identifiants de paiement bruts.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { DisputeCategorySchema, DisputeDesiredOutcomeSchema } from "../booking/booking.enums";
import { DisputeResolutionOutcomeSchema, DisputeResolutionViewSchema, RetentionArbitrationOutcomeSchema } from "../booking/booking-settlement.schema";

export const ArbitrationKindSchema = z.enum(["DISPUTE", "RETENTION"]).meta({ id: "ArbitrationKind" });
export type ArbitrationKind = z.infer<typeof ArbitrationKindSchema>;

const PartySchema = z.object({
  id: ObjectIdSchema,
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  completedDealsCount: z.number().int(),
  lateCancellationsCount: z.number().int(),
  disputesLostCount: z.number().int().meta({ description: "Internal reputation fact (D29②, D55 4A) — never public" }),
  ratingsAvg: z.number(),
  ratingsCount: z.number().int(),
});

export const ArbitrationQueueItemSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: ArbitrationKindSchema,
    ticketNumber: z.string().nullable(),
    category: DisputeCategorySchema.nullable(),
    openedAt: z.string().datetime(),
    originCity: z.string(),
    destinationCity: z.string(),
    amountCents: z.number().int().meta({ description: "Total paid by the shipper (DISPUTE) or retained amount (RETENTION)" }),
    currencyCode: z.string(),
    shipperFirstName: z.string(),
    carrierFirstName: z.string(),
    carrierResponded: z.boolean().meta({ description: "DISPUTE: the carrier gave their side" }),
    decidableAt: z.string().datetime().meta({ description: "When a decision becomes possible: now if responded / RETENTION, else disputedAt + 72h" }),
  })
  .meta({ id: "ArbitrationQueueItem" });
export type ArbitrationQueueItem = z.infer<typeof ArbitrationQueueItemSchema>;

export const ArbitrationQueueResponseSchema = z
  .object({ items: z.array(ArbitrationQueueItemSchema), counts: z.object({ disputes: z.number().int(), retentions: z.number().int() }) })
  .meta({ id: "ArbitrationQueueResponse" });
export type ArbitrationQueueResponse = z.infer<typeof ArbitrationQueueResponseSchema>;

export const AdminDisputeFileSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: ArbitrationKindSchema,
    status: z.string(),
    timeline: z.object({
      requestedAt: z.string().datetime(),
      acceptedAt: z.string().datetime().nullable(),
      departureAt: z.string().datetime(),
      pickedUpAt: z.string().datetime().nullable(),
      deliveredAt: z.string().datetime().nullable(),
      disputedAt: z.string().datetime().nullable(),
      closedAt: z.string().datetime().nullable(),
      closedBy: z.string().nullable(),
      cancelReason: z.string().nullable(),
    }),
    corridor: z.object({ originCity: z.string(), destinationCity: z.string(), transportMode: z.string().nullable() }),
    parcel: z.object({
      category: z.string(),
      description: z.string(),
      declaredValueCents: z.number().int(),
      weightKg: z.number(),
      photoUrls: z.array(z.string()),
    }),
    recipient: z.object({ firstName: z.string(), lastName: z.string() }),
    money: z.object({
      totalShipperCents: z.number().int(),
      transportCents: z.number().int().meta({ description: "Carrier net" }),
      commissionCents: z.number().int(),
      premiumCents: z.number().int(),
      currencyCode: z.string(),
      capturedAt: z.string().datetime().nullable(),
      refundedAt: z.string().datetime().nullable(),
      refundAmountCents: z.number().int().nullable(),
      payoutStatus: z.string().nullable(),
      payoutAmountCents: z.number().int().nullable(),
      retentionCents: z.number().int().nullable(),
      retentionDisposition: z.string().nullable(),
    }),
    shipper: PartySchema,
    carrier: PartySchema,
    pickup: z
      .object({ confirmedAt: z.string().datetime(), photoUrls: z.array(z.string()), checklist: z.array(z.string()), notes: z.string().nullable() })
      .nullable(),
    trackingEvents: z.array(z.object({ step: z.string(), confirmedAt: z.string().datetime() })),
    deliveryPhotoUrls: z.array(z.string()),
    dispute: z
      .object({
        ticketNumber: z.string(),
        category: DisputeCategorySchema,
        description: z.string(),
        desiredOutcome: DisputeDesiredOutcomeSchema.nullable(),
        photoUrls: z.array(z.string()),
        pledgeAcceptedAt: z.string().datetime(),
        status: z.string(),
        carrierStatement: z
          .object({ statement: z.string(), photoUrls: z.array(z.string()), respondedAt: z.string().datetime() })
          .nullable(),
        responseDeadlineAt: z.string().datetime(),
        resolution: DisputeResolutionViewSchema.nullable(),
      })
      .nullable(),
    retentionDecision: z.object({ outcome: RetentionArbitrationOutcomeSchema, reason: z.string(), decidedAt: z.string().datetime() }).nullable(),
    canDecide: z.boolean().meta({ description: "A decision is possible now (responded, or 72h elapsed, or RETENTION) and none was taken yet" }),
    decidableAt: z.string().datetime().nullable(),
    proposedAmounts: z
      .object({
        rejectedCarrierPayoutCents: z.number().int(),
        fullRefundCents: z.number().int(),
        compensateCarrierCents: z.number().int().nullable(),
        restituteShipperCents: z.number().int().nullable(),
      })
      .meta({ description: "Server-computed amounts shown in the admin recap (D55 2A/3A)" }),
  })
  .meta({ id: "AdminDisputeFile", description: "Full mediation file for an admin — never the delivery code (D43)" });
export type AdminDisputeFile = z.infer<typeof AdminDisputeFileSchema>;

/* ══ C-PR2 (D55) — décisions ══════════════════════════════════ */

export const AdminResolveDisputeRequestSchema = z
  .object({
    outcome: DisputeResolutionOutcomeSchema,
    refundCents: z.number().int().positive().optional().meta({ description: "PARTIAL_REFUND only: 1 ≤ amount ≤ totalShipperCents − 1" }),
    reason: z.string().trim().min(50, "Reason must be at least 50 characters").max(2000),
  })
  .meta({ id: "AdminResolveDisputeRequest", description: "Irreversible. Refund first, then the carrier transfer through the payout executor (D49)." });
export type AdminResolveDisputeRequest = z.infer<typeof AdminResolveDisputeRequestSchema>;

export const AdminResolveRetentionRequestSchema = z
  .object({
    outcome: RetentionArbitrationOutcomeSchema,
    reason: z.string().trim().min(50, "Reason must be at least 50 characters").max(2000),
  })
  .meta({ id: "AdminResolveRetentionRequest", description: "Amounts are computed server-side (pro-rata A79 or the retained amount)" });
export type AdminResolveRetentionRequest = z.infer<typeof AdminResolveRetentionRequestSchema>;

export const AdminResolutionResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: ArbitrationKindSchema,
    finalStatus: z.enum(["COMPLETED", "CANCELLED"]),
    outcome: z.string(),
    refundCents: z.number().int(),
    carrierPayoutCents: z.number().int(),
    payoutStatus: z.string().nullable().meta({ description: "SENT / FAILED (retried by the cron) / null when nothing is owed to the carrier" }),
    resolvedAt: z.iso.datetime(),
  })
  .meta({ id: "AdminResolutionResponse" });
export type AdminResolutionResponse = z.infer<typeof AdminResolutionResponseSchema>;

/* ── C-PR7a (D60 2A) — filtres de la file « à arbitrer » ── */
export const ArbitrationQueueQuerySchema = z
  .object({
    kind: ArbitrationKindSchema.optional(),
    originCity: z.string().trim().max(80).optional(),
    destinationCity: z.string().trim().max(80).optional(),
    olderThanDays: z.coerce.number().int().min(0).max(365).optional(),
    decidable: z.enum(["1", "0"]).optional().meta({ description: "1 = décision possible maintenant" }),
  })
  .meta({ id: "ArbitrationQueueQuery" });
export type ArbitrationQueueQuery = z.infer<typeof ArbitrationQueueQuerySchema>;
