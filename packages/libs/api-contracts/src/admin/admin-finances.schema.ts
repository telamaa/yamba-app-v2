/**
 * admin-finances.schema.ts — finances côté admin (C-PR5a, D58)
 * =============================================================
 * Files d'exception, fiche argent d'un deal, rapprochement fournisseur, gestes sur les versements.
 * Aucun montant recalculé : tout vient du snapshot et des champs posés par les transitions (RG-FIN-01).
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const FinanceQueueKindSchema = z.enum(["FAILED", "REVERSED", "HELD", "PROPOSED_REFUNDS"]).meta({ id: "FinanceQueueKind", description: "FAILED = versements en échec · REVERSED = transferts renversés non clos · HELD = retenues conservées à arbitrer · PROPOSED_REFUNDS = remboursements manuels proposés, à décider (C-PR5b)" });
export type FinanceQueueKind = z.infer<typeof FinanceQueueKindSchema>;

export const PayoutFailureKindSchema = z.enum(["ACCOUNT_NOT_READY", "PROVIDER_ERROR", "REVERSED"]).meta({ id: "PayoutFailureKind" });
export type PayoutFailureKind = z.infer<typeof PayoutFailureKindSchema>;

const Corridor = z.object({ originCity: z.string(), destinationCity: z.string(), departureAt: z.string().datetime().nullable() });

export const FinanceQueueItemSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: FinanceQueueKindSchema,
    status: z.string(),
    corridor: Corridor,
    shipper: z.object({ id: ObjectIdSchema, firstName: z.string() }),
    carrier: z.object({ id: ObjectIdSchema, firstName: z.string(), stripeReady: z.boolean().nullable() }),
    amountCents: z.number().int().describe("Montant concerné : versement (FAILED / REVERSED) ou retenue (HELD)"),
    currencyCode: z.string(),
    payoutStatus: z.string().nullable(),
    payoutAttempts: z.number().int(),
    payoutFailureKind: PayoutFailureKindSchema.nullable(),
    payoutFailureDetail: z.string().nullable().describe("Message fournisseur brut — admin seulement, jamais servi au Voyageur (A75)"),
    lastAttemptAt: z.string().datetime().nullable(),
    nextRetryAt: z.string().datetime().nullable(),
    disputeTicket: z.string().nullable(),
    since: z.string().datetime().describe("Depuis quand l'exception existe (fin du deal ou dernière écriture)"),
  })
  .meta({ id: "FinanceQueueItem" });
export type FinanceQueueItem = z.infer<typeof FinanceQueueItemSchema>;
export const FinanceQueueResponseSchema = z
  .object({ kind: FinanceQueueKindSchema, items: z.array(FinanceQueueItemSchema), generatedAt: z.string().datetime() })
  .meta({ id: "FinanceQueueResponse" });
export type FinanceQueueResponse = z.infer<typeof FinanceQueueResponseSchema>;

export const MoneyTimelineKindSchema = z
  .enum(["AUTHORIZED", "CAPTURED", "REFUNDED", "DISPUTED", "COMPLETED", "CANCELLED", "PAYOUT_SENT", "PAYOUT_FAILED", "PAYOUT_REVERSED", "REVERSAL_RESOLVED", "RETENTION", "RETENTION_DECIDED"])
  .meta({ id: "MoneyTimelineKind" });
export type MoneyTimelineKind = z.infer<typeof MoneyTimelineKindSchema>;
export const MoneyTimelineEventSchema = z
  .object({ at: z.string().datetime(), kind: MoneyTimelineKindSchema, amountCents: z.number().int().nullable(), detail: z.string().nullable() })
  .meta({ id: "MoneyTimelineEvent" });
export type MoneyTimelineEvent = z.infer<typeof MoneyTimelineEventSchema>;

export const AdminDealMoneyFileSchema = z
  .object({
    id: ObjectIdSchema,
    status: z.string(),
    disputeTicket: z.string().nullable(),
    corridor: Corridor,
    shipper: z.object({ id: ObjectIdSchema, firstName: z.string(), lastName: z.string() }),
    carrier: z.object({ id: ObjectIdSchema, firstName: z.string(), lastName: z.string(), stripeAccountIdMasked: z.string().nullable(), stripePayoutsEnabled: z.boolean().nullable() }),
    pricing: z.object({
      pricingModel: z.string(),
      weightKg: z.number(),
      transportCents: z.number().int(),
      commissionCents: z.number().int(),
      premiumCents: z.number().int(),
      totalShipperCents: z.number().int(),
      currencyCode: z.string(),
    }),
    payment: z.object({
      provider: z.string().nullable(),
      intentId: z.string().nullable(),
      chargeId: z.string().nullable(),
      capturedAt: z.string().datetime().nullable(),
      refundedAt: z.string().datetime().nullable(),
      refundAmountCents: z.number().int().nullable(),
      refundId: z.string().nullable(),
    }),
    payout: z.object({
      status: z.string().nullable(),
      amountCents: z.number().int().nullable(),
      sentAt: z.string().datetime().nullable(),
      attempts: z.number().int(),
      failureKind: PayoutFailureKindSchema.nullable(),
      failureDetail: z.string().nullable(),
      lastAttemptAt: z.string().datetime().nullable(),
      nextRetryAt: z.string().datetime().nullable(),
      transferId: z.string().nullable(),
      reversal: z.object({ resolution: z.string(), reason: z.string(), at: z.string().datetime(), byAdmin: z.string() }).nullable(),
    }),
    retention: z
      .object({ cents: z.number().int(), disposition: z.string().nullable(), decisionReason: z.string().nullable(), decidedAt: z.string().datetime().nullable() })
      .nullable(),
    dates: z.object({
      requestedAt: z.string().datetime(),
      acceptedAt: z.string().datetime().nullable(),
      pickedUpAt: z.string().datetime().nullable(),
      deliveredAt: z.string().datetime().nullable(),
      disputedAt: z.string().datetime().nullable(),
      completedAt: z.string().datetime().nullable(),
      completedBy: z.string().nullable(),
      closedAt: z.string().datetime().nullable(),
      closedBy: z.string().nullable(),
    }),
    timeline: z.array(MoneyTimelineEventSchema),
    adminActions: z.array(z.object({ id: ObjectIdSchema, at: z.string().datetime(), admin: z.string(), action: z.string(), after: z.unknown().nullable() })),
    // C-PR5b (D58 3A-c) — remboursement manuel
    manualRefund: z.object({
      maxRefundableCents: z.number().int().describe("total payé − déjà remboursé ; 0 = plus rien à rembourser"),
      proposal: z.object({ amountCents: z.number().int(), reason: z.string(), byAdmin: z.string(), at: z.string().datetime() }).nullable(),
      last: z.object({ amountCents: z.number().int(), reason: z.string(), byAdmin: z.string(), at: z.string().datetime() }).nullable(),
    }),
    allowedActions: z.object({ retryPayout: z.boolean(), resolveReversal: z.boolean(), reconcile: z.boolean(), proposeRefund: z.boolean(), applyRefund: z.boolean() }),
  })
  .meta({ id: "AdminDealMoneyFile" });
export type AdminDealMoneyFile = z.infer<typeof AdminDealMoneyFileSchema>;

export const ReconciliationDivergenceCodeSchema = z
  .enum([
    "CAPTURE_NOT_RECORDED",
    "CAPTURE_RECORDED_NOT_LIVE",
    "REFUND_NOT_RECORDED",
    "REFUND_RECORDED_NOT_LIVE",
    "TRANSFER_MISSING",
    "TRANSFER_AMOUNT_MISMATCH",
    "TRANSFER_REVERSED_NOT_MARKED",
    "TRANSFER_MARKED_REVERSED_BUT_LIVE_OK",
    "INTENT_NOT_FOUND",
  ])
  .meta({ id: "ReconciliationDivergenceCode" });
export type ReconciliationDivergenceCode = z.infer<typeof ReconciliationDivergenceCodeSchema>;

export const PaymentReconciliationSchema = z
  .object({
    provider: z.string(),
    checkedAt: z.string().datetime(),
    live: z
      .object({
        intentStatus: z.string(),
        amountCents: z.number().int(),
        amountReceivedCents: z.number().int(),
        chargeId: z.string().nullable(),
        refunds: z.array(z.object({ id: z.string(), amountCents: z.number().int(), status: z.string(), createdAt: z.string().datetime().nullable() })),
        transfer: z.object({ id: z.string(), amountCents: z.number().int(), reversedCents: z.number().int(), createdAt: z.string().datetime().nullable() }).nullable(),
      })
      .nullable(),
    divergences: z.array(z.object({ code: ReconciliationDivergenceCodeSchema, message: z.string(), dbCents: z.number().int().nullable(), liveCents: z.number().int().nullable() })),
  })
  .meta({ id: "PaymentReconciliation", description: "Lecture seule chez le fournisseur ; la base n'est jamais modifiée par un rapprochement (D58 4A)" });
export type PaymentReconciliation = z.infer<typeof PaymentReconciliationSchema>;

export const RetryPayoutResponseSchema = z
  .object({ payoutStatus: z.enum(["SENT", "FAILED"]), reason: z.string().nullable(), transferId: z.string().nullable() })
  .meta({ id: "RetryPayoutResponse" });
export type RetryPayoutResponse = z.infer<typeof RetryPayoutResponseSchema>;

export const REVERSAL_MIN_REASON_LENGTH = 20;
export const ResolveReversalRequestSchema = z
  .object({
    outcome: z.enum(["RESENT", "WRITTEN_OFF"]).describe("RESENT = nouveau transfert par l'exécuteur unique · WRITTEN_OFF = manque à gagner assumé, rien n'est renvoyé"),
    reason: z.string().trim().min(REVERSAL_MIN_REASON_LENGTH).max(2000),
  })
  .meta({ id: "ResolveReversalRequest" });
export type ResolveReversalRequest = z.infer<typeof ResolveReversalRequestSchema>;
export const ResolveReversalResponseSchema = z
  .object({ outcome: z.enum(["RESENT", "WRITTEN_OFF"]), payoutStatus: z.string().nullable(), reason: z.string().nullable() })
  .meta({ id: "ResolveReversalResponse" });
export type ResolveReversalResponse = z.infer<typeof ResolveReversalResponseSchema>;

/* ── C-PR5b (D58 5A) — rapport mensuel par devise, calculé depuis le Booking ── */
export const FinanceReportMonthSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("YYYY-MM (UTC)"),
    currencyCode: z.string(),
    capturedCents: z.number().int().describe("Encaissé : total payé des deals capturés ce mois"),
    capturedCount: z.number().int(),
    refundedCents: z.number().int().describe("Remboursé aux Expéditeurs ce mois (toutes causes, manuel compris)"),
    refundCount: z.number().int(),
    paidOutCents: z.number().int().describe("Versé aux Voyageurs ce mois (versements SENT, renversés inclus car partis)"),
    payoutCount: z.number().int(),
    revenueCents: z.number().int().describe("Revenu reconnu : commission + prime des deals terminés ce mois (COMPLETED)"),
    completedCount: z.number().int(),
    retentionCents: z.number().int().describe("Retenues nées ce mois (annulations tardives), quel que soit leur sort"),
    cancelledCount: z.number().int(),
  })
  .meta({ id: "FinanceReportMonth" });
export type FinanceReportMonth = z.infer<typeof FinanceReportMonthSchema>;

export const FinanceSnapshotSchema = z
  .object({
    currencyCode: z.string(),
    pendingPayoutCents: z.number().int().describe("Dû aux Voyageurs : PENDING + FAILED (passif)"),
    frozenPayoutCents: z.number().int().describe("Gelé par un litige (FROZEN)"),
    reversedOpenCents: z.number().int().describe("Transferts renversés non clos (argent revenu, à décider)"),
    heldRetentionCents: z.number().int().describe("Retenues conservées à arbitrer (passif, pas un revenu)"),
    proposedRefundCents: z.number().int().describe("Remboursements manuels proposés, non appliqués"),
  })
  .meta({ id: "FinanceSnapshot" });
export type FinanceSnapshot = z.infer<typeof FinanceSnapshotSchema>;

export const FinanceReportSchema = z
  .object({ from: z.string().datetime(), to: z.string().datetime(), generatedAt: z.string().datetime(), months: z.array(FinanceReportMonthSchema), snapshot: z.array(FinanceSnapshotSchema) })
  .meta({ id: "FinanceReport", description: "Aucun grand livre (D58 1A) : agrégats des champs posés par les transitions. Les frais Stripe ne sont pas en base — rapprocher avec l'export Stripe." });
export type FinanceReport = z.infer<typeof FinanceReportSchema>;

/* ── C-PR5b (D58 3A-c) — remboursement manuel ── */
export const MANUAL_REFUND_MIN_REASON_LENGTH = 50;
export const ManualRefundRequestSchema = z
  .object({
    amountCents: z.number().int().min(1),
    reason: z.string().trim().min(MANUAL_REFUND_MIN_REASON_LENGTH).max(2000),
  })
  .meta({ id: "ManualRefundRequest", description: "Montant en centimes ≤ total payé − déjà remboursé ; motif ≥ 50 caractères (geste commercial, jamais une décision de litige)" });
export type ManualRefundRequest = z.infer<typeof ManualRefundRequestSchema>;
export const ManualRefundResponseSchema = z
  .object({ bookingId: ObjectIdSchema, refundedCents: z.number().int(), totalRefundedCents: z.number().int(), refundId: z.string().nullable(), currencyCode: z.string() })
  .meta({ id: "ManualRefundResponse" });
export type ManualRefundResponse = z.infer<typeof ManualRefundResponseSchema>;
