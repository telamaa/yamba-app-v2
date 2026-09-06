/**
 * admin-finance.service.ts — finances côté admin (C-PR5a, D58)
 * ============================================================
 * Files d'exception (2A), fiche argent de tout deal (4A), rapprochement fournisseur
 * en lecture seule (A112), rejeu d'un versement et clôture d'un renversement (3A).
 * Aucun montant recalculé ici : on lit le snapshot et les champs posés par les
 * transitions ; les gestes passent par l'exécuteur unique de versement (A65).
 * Chaque geste est journalisé dans la MÊME transaction que son écriture.
 */
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { PaymentProvider } from "@packages/payments";
import type {
  AdminDealMoneyFile,
  FinanceQueueItem,
  FinanceQueueKind,
  FinanceQueueResponse,
  FinanceReport,
  ManualRefundRequest,
  ManualRefundResponse,
  PaymentReconciliation,
  ResolveReversalRequest,
  ResolveReversalResponse,
  RetryPayoutResponse,
} from "@packages/api-contracts";
import { BookingLifecycleError, baseEventPayload } from "./booking-lifecycle";
import { BOOKING_WRITE_SELECT, applyBookingTransition, loadBookingForWrite, toBookingForWrite, type BookingForWrite } from "./booking-write";
import type { DealSettlementService } from "./deal-settlement.service";
import { assertNotParty } from "./deal-mediation.service";
import {
  buildFinanceCsv,
  buildFinanceReport,
  buildFinanceSnapshot,
  buildMoneyTimeline,
  csvRowInRange,
  manualRefundBounds,
  maskAccountId,
  monthStartUtc,
  payoutFailureDetail,
  payoutFailureKind,
  reconcile,
  type FinanceCsvRow,
} from "./admin-finance.rules";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export type AdminActor = { id: string; ip: string | null; userAgent: string | null };

/** Lecture « argent » d'un Booking — sur-ensemble de BOOKING_WRITE_SELECT (l'exécuteur relit le sien). */
const MONEY_SELECT = {
  ...BOOKING_WRITE_SELECT,
  requestedAt: true,
  capturedAt: true,
  refundedAt: true,
  refundId: true,
  paymentProvider: true,
  completedAt: true,
  completedBy: true,
  closedAt: true,
  closedBy: true,
  payoutSentAt: true,
  payoutFailureReason: true,
  payoutLastAttemptAt: true,
  payoutReversalResolution: true,
  payoutReversalReason: true,
  payoutReversalResolvedAt: true,
  payoutReversalResolvedByAdminId: true,
  retentionDecisionReason: true,
  retentionDecidedAt: true,
  // C-PR5b — remboursement manuel
  manualRefundProposedCents: true,
  manualRefundProposedReason: true,
  manualRefundProposedByAdminId: true,
  manualRefundProposedAt: true,
  manualRefundCents: true,
  manualRefundReason: true,
  manualRefundByAdminId: true,
  manualRefundAt: true,
} as const;

type MoneyRecord = {
  id: string;
  status: string;
  shipperId: string;
  carrierId: string;
  isDeleted: boolean;
  trip: { originCity: string; destinationCity: string; departureAt: Date };
  pricing: { pricingModel: string; weightKg: number; transportCents: number; commissionCents: number; premiumCents: number; totalShipperCents: number; currencyCode: string };
  paymentIntentId: string | null;
  paymentProvider?: string | null;
  chargeId?: string | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt?: Date | null;
  disputedAt?: Date | null;
  disputeTicket?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  closedAt?: Date | null;
  closedBy?: string | null;
  capturedAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
  refundId?: string | null;
  payoutStatus?: string | null;
  payoutAmountCents?: number | null;
  payoutSentAt?: Date | null;
  payoutAttempts?: number | null;
  payoutFailureReason?: string | null;
  payoutLastAttemptAt?: Date | null;
  payoutNextRetryAt?: Date | null;
  transferId?: string | null;
  payoutReversalResolution?: string | null;
  payoutReversalReason?: string | null;
  payoutReversalResolvedAt?: Date | null;
  payoutReversalResolvedByAdminId?: string | null;
  retentionCents?: number | null;
  retentionDisposition?: string | null;
  retentionDecisionReason?: string | null;
  retentionDecidedAt?: Date | null;
  updatedAt?: Date | null;
  manualRefundProposedCents?: number | null;
  manualRefundProposedReason?: string | null;
  manualRefundProposedByAdminId?: string | null;
  manualRefundProposedAt?: Date | null;
  manualRefundCents?: number | null;
  manualRefundReason?: string | null;
  manualRefundByAdminId?: string | null;
  manualRefundAt?: Date | null;
};

/** Période d'export bornée : au-delà, le comptable passe par l'export Stripe. */
const EXPORT_MAX_DAYS = 366;

const UNRESOLVED_REVERSAL = { OR: [{ payoutReversalResolution: { isSet: false } }, { payoutReversalResolution: null }] };

function queueWhere(kind: FinanceQueueKind): Record<string, unknown> {
  switch (kind) {
    case "FAILED":
      return { status: { in: ["COMPLETED", "CANCELLED"] }, payoutStatus: "FAILED" };
    case "REVERSED":
      return { payoutStatus: "REVERSED", ...UNRESOLVED_REVERSAL };
    case "HELD":
      return { status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" };
    case "PROPOSED_REFUNDS":
      return { manualRefundProposedCents: { gt: 0 } };
  }
}

async function namesOf(ids: string[]): Promise<Map<string, { firstName: string; lastName: string }>> {
  const clean = [...new Set(ids.filter(Boolean))];
  const rows = clean.length ? await prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, firstName: true, lastName: true } }) : [];
  return new Map(rows.map((r) => [r.id, { firstName: r.firstName, lastName: r.lastName }]));
}

async function stripeReadiness(carrierIds: string[]): Promise<Map<string, { accountId: string | null; payoutsEnabled: boolean }>> {
  const clean = [...new Set(carrierIds)];
  const rows = clean.length ? await prisma.carrierPage.findMany({ where: { userId: { in: clean } }, select: { userId: true, stripeAccountId: true, stripePayoutsEnabled: true } }) : [];
  return new Map(rows.map((r) => [r.userId, { accountId: r.stripeAccountId ?? null, payoutsEnabled: !!r.stripePayoutsEnabled }]));
}

export function makeAdminFinanceService(provider: PaymentProvider, settlement: DealSettlementService, clock: () => Date = () => new Date()) {
  async function loadMoney(id: string): Promise<MoneyRecord> {
    const b = await prisma.booking.findUnique({ where: { id }, select: MONEY_SELECT });
    if (!b || b.isDeleted) throw new NotFoundError("Deal not found.");
    return b as unknown as MoneyRecord;
  }

  function audit(admin: AdminActor, action: string, targetId: string, after?: unknown) {
    return { adminUserId: admin.id, action, targetType: "BOOKING", targetId, after: after ?? null, ip: admin.ip, userAgent: admin.userAgent };
  }

  return {
    /* ── Files d'exception (2A) ──────────────────────────────── */
    async listQueue(kind: FinanceQueueKind): Promise<FinanceQueueResponse> {
      const now = clock();
      const rows = (await prisma.booking.findMany({
        where: { isDeleted: false, ...queueWhere(kind) } as never,
        select: MONEY_SELECT,
        take: 200,
        orderBy: { updatedAt: "asc" },
      })) as unknown as MoneyRecord[];
      const moneyKind = kind === "FAILED" || kind === "REVERSED";
      const [names, ready] = await Promise.all([namesOf(rows.flatMap((b) => [b.shipperId, b.carrierId])), moneyKind ? stripeReadiness(rows.map((b) => b.carrierId)) : Promise.resolve(new Map())]);
      const items: FinanceQueueItem[] = rows.map((b) => {
        const r = ready.get(b.carrierId);
        return {
          bookingId: b.id,
          kind,
          status: b.status,
          corridor: { originCity: b.trip.originCity, destinationCity: b.trip.destinationCity, departureAt: iso(b.trip.departureAt) },
          shipper: { id: b.shipperId, firstName: names.get(b.shipperId)?.firstName ?? "—" },
          carrier: { id: b.carrierId, firstName: names.get(b.carrierId)?.firstName ?? "—", stripeReady: moneyKind ? !!(r?.accountId && r.payoutsEnabled) : null },
          amountCents: kind === "HELD" ? (b.retentionCents ?? 0) : kind === "PROPOSED_REFUNDS" ? (b.manualRefundProposedCents ?? 0) : (b.payoutAmountCents ?? b.pricing.transportCents),
          currencyCode: b.pricing.currencyCode,
          payoutStatus: b.payoutStatus ?? null,
          payoutAttempts: b.payoutAttempts ?? 0,
          payoutFailureKind: payoutFailureKind(b.payoutStatus, b.payoutFailureReason),
          payoutFailureDetail: payoutFailureDetail(b.payoutFailureReason),
          lastAttemptAt: iso(b.payoutLastAttemptAt),
          nextRetryAt: iso(b.payoutNextRetryAt),
          disputeTicket: b.disputeTicket ?? null,
          since: ((kind === "PROPOSED_REFUNDS" ? b.manualRefundProposedAt : null) ?? b.completedAt ?? b.closedAt ?? b.updatedAt ?? now).toISOString(),
        };
      });
      return { kind, items, generatedAt: now.toISOString() };
    },

    /* ── Fiche argent (4A) ───────────────────────────────────── */
    async getMoneyFile(admin: AdminActor, id: string): Promise<AdminDealMoneyFile> {
      const b = await loadMoney(id);
      const [names, ready, actions] = await Promise.all([
        namesOf([b.shipperId, b.carrierId, b.payoutReversalResolvedByAdminId ?? "", b.manualRefundProposedByAdminId ?? "", b.manualRefundByAdminId ?? ""]),
        stripeReadiness([b.carrierId]),
        prisma.adminAction.findMany({ where: { targetType: "BOOKING", targetId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      ]);
      const adminNames = await namesOf(actions.map((a) => a.adminUserId));
      const nameOf = (uid: string | null | undefined) => {
        const n = uid ? (names.get(uid) ?? adminNames.get(uid)) : null;
        return n ? `${n.firstName} ${n.lastName.charAt(0)}.` : (uid ?? "—");
      };
      const r = ready.get(b.carrierId);
      const isParty = admin.id === b.shipperId || admin.id === b.carrierId;
      const reversalOpen = b.payoutStatus === "REVERSED" && !b.payoutReversalResolution;
      const refundBounds = manualRefundBounds(b);
      const file: AdminDealMoneyFile = {
        id: b.id,
        status: b.status,
        disputeTicket: b.disputeTicket ?? null,
        corridor: { originCity: b.trip.originCity, destinationCity: b.trip.destinationCity, departureAt: iso(b.trip.departureAt) },
        shipper: { id: b.shipperId, firstName: names.get(b.shipperId)?.firstName ?? "—", lastName: names.get(b.shipperId)?.lastName ?? "" },
        carrier: {
          id: b.carrierId,
          firstName: names.get(b.carrierId)?.firstName ?? "—",
          lastName: names.get(b.carrierId)?.lastName ?? "",
          stripeAccountIdMasked: maskAccountId(r?.accountId),
          stripePayoutsEnabled: r ? r.payoutsEnabled : null,
        },
        pricing: {
          pricingModel: String(b.pricing.pricingModel),
          weightKg: b.pricing.weightKg,
          transportCents: b.pricing.transportCents,
          commissionCents: b.pricing.commissionCents,
          premiumCents: b.pricing.premiumCents,
          totalShipperCents: b.pricing.totalShipperCents,
          currencyCode: b.pricing.currencyCode,
        },
        payment: {
          provider: b.paymentProvider ?? null,
          intentId: b.paymentIntentId,
          chargeId: b.chargeId ?? null,
          capturedAt: iso(b.capturedAt),
          refundedAt: iso(b.refundedAt),
          refundAmountCents: b.refundAmountCents ?? null,
          refundId: b.refundId ?? null,
        },
        payout: {
          status: b.payoutStatus ?? null,
          amountCents: b.payoutAmountCents ?? null,
          sentAt: iso(b.payoutSentAt),
          attempts: b.payoutAttempts ?? 0,
          failureKind: payoutFailureKind(b.payoutStatus, b.payoutFailureReason),
          failureDetail: payoutFailureDetail(b.payoutFailureReason),
          lastAttemptAt: iso(b.payoutLastAttemptAt),
          nextRetryAt: iso(b.payoutNextRetryAt),
          transferId: b.transferId ?? null,
          reversal: b.payoutReversalResolution && b.payoutReversalResolvedAt
            ? { resolution: b.payoutReversalResolution, reason: b.payoutReversalReason ?? "", at: b.payoutReversalResolvedAt.toISOString(), byAdmin: nameOf(b.payoutReversalResolvedByAdminId) }
            : null,
        },
        retention: (b.retentionCents ?? 0) > 0
          ? { cents: b.retentionCents ?? 0, disposition: b.retentionDisposition ?? null, decisionReason: b.retentionDecisionReason ?? null, decidedAt: iso(b.retentionDecidedAt) }
          : null,
        dates: {
          requestedAt: b.requestedAt.toISOString(),
          acceptedAt: iso(b.acceptedAt),
          pickedUpAt: iso(b.pickedUpAt),
          deliveredAt: iso(b.deliveredAt),
          disputedAt: iso(b.disputedAt),
          completedAt: iso(b.completedAt),
          completedBy: b.completedBy ?? null,
          closedAt: iso(b.closedAt),
          closedBy: b.closedBy ?? null,
        },
        timeline: buildMoneyTimeline(b),
        adminActions: actions.map((a) => ({ id: a.id, at: a.createdAt.toISOString(), admin: nameOf(a.adminUserId), action: a.action, after: a.after ?? null })),
        manualRefund: {
          maxRefundableCents: refundBounds.maxRefundableCents,
          proposal:
            (b.manualRefundProposedCents ?? 0) > 0 && b.manualRefundProposedAt
              ? { amountCents: b.manualRefundProposedCents ?? 0, reason: b.manualRefundProposedReason ?? "", byAdmin: nameOf(b.manualRefundProposedByAdminId), at: b.manualRefundProposedAt.toISOString() }
              : null,
          last:
            (b.manualRefundCents ?? 0) > 0 && b.manualRefundAt
              ? { amountCents: b.manualRefundCents ?? 0, reason: b.manualRefundReason ?? "", byAdmin: nameOf(b.manualRefundByAdminId), at: b.manualRefundAt.toISOString() }
              : null,
        },
        allowedActions: {
          retryPayout: !isParty && (b.status === "COMPLETED" || b.status === "CANCELLED") && (b.payoutStatus === "FAILED" || b.payoutStatus === "PENDING"),
          resolveReversal: !isParty && reversalOpen,
          reconcile: !!b.paymentIntentId,
          proposeRefund: !isParty && refundBounds.allowed,
          applyRefund: !isParty && refundBounds.allowed,
        },
      };
      await recordAdminAction(prisma, audit(admin, "DEAL_MONEY_VIEWED", id));
      return file;
    },

    /* ── Rapprochement fournisseur (A112) — lecture seule ────── */
    async reconcileDeal(admin: AdminActor, id: string): Promise<PaymentReconciliation> {
      const b = await loadMoney(id);
      const now = clock();
      if (!b.paymentIntentId) throw new ValidationError("This deal has no payment to reconcile.");
      let live: PaymentReconciliation["live"] = null;
      let divergences: PaymentReconciliation["divergences"];
      try {
        const insp = await provider.inspect({ intentId: b.paymentIntentId, transferId: b.transferId ?? null });
        live = {
          intentStatus: insp.status,
          amountCents: insp.amountCents,
          amountReceivedCents: insp.amountReceivedCents,
          chargeId: insp.chargeId,
          refunds: insp.refunds,
          transfer: insp.transfer,
        };
        divergences = reconcile(
          { capturedAt: b.capturedAt ?? null, refundAmountCents: b.refundAmountCents ?? null, payoutStatus: b.payoutStatus ?? null, payoutAmountCents: b.payoutAmountCents ?? null, transferId: b.transferId ?? null },
          insp
        );
      } catch (err) {
        divergences = [{ code: "INTENT_NOT_FOUND", message: `The provider could not return this payment: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), dbCents: null, liveCents: null }];
      }
      await recordAdminAction(prisma, audit(admin, "DEAL_RECONCILED", id, { provider: provider.name, divergences: divergences.map((d) => d.code) }));
      return { provider: provider.name, checkedAt: now.toISOString(), live, divergences };
    },

    /* ── Rejouer un versement (3A-a) ─────────────────────────── */
    async retryPayout(admin: AdminActor, id: string): Promise<RetryPayoutResponse> {
      const booking = await loadBookingForWrite(id);
      assertNotParty(admin, booking);
      if (booking.status !== "COMPLETED" && booking.status !== "CANCELLED") throw new ValidationError("Only a completed or late-cancelled deal has a payout.");
      if (booking.payoutStatus !== "FAILED" && booking.payoutStatus !== "PENDING") throw new ValidationError(`Nothing to retry: payout is ${booking.payoutStatus ?? "not scheduled"}.`);
      const now = clock();
      let outcome: { payoutStatus: "SENT" | "FAILED"; transferId: string | null; reason: string | null };
      try {
        outcome = await settlement.executePayout(booking, now);
      } catch (err) {
        if (err instanceof BookingLifecycleError) throw new ValidationError(err.message);
        throw err;
      }
      await recordAdminAction(prisma, audit(admin, "PAYOUT_RETRIED", id, { outcome: outcome.payoutStatus, reason: outcome.reason, transferId: outcome.transferId }));
      return { payoutStatus: outcome.payoutStatus, reason: outcome.reason, transferId: outcome.transferId };
    },

    /* ── Clore un renversement (3A-b) ────────────────────────── */
    async resolveReversal(admin: AdminActor, id: string, input: ResolveReversalRequest): Promise<ResolveReversalResponse> {
      const booking = await loadBookingForWrite(id);
      assertNotParty(admin, booking);
      const now = clock();
      const data =
        input.outcome === "RESENT"
          ? {
              // Nouveau transfert : nouvelle clé d'idempotence (l'ancienne renverrait le transfert renversé), puis l'exécuteur unique.
              payoutStatus: "PENDING",
              payoutFailureReason: null,
              payoutNextRetryAt: null,
              payoutIdempotencyKey: `payout:${id}:resend:${now.getTime()}`,
              payoutReversalResolution: "RESENT",
              payoutReversalReason: input.reason,
              payoutReversalResolvedAt: now,
              payoutReversalResolvedByAdminId: admin.id,
            }
          : {
              payoutReversalResolution: "WRITTEN_OFF",
              payoutReversalReason: input.reason,
              payoutReversalResolvedAt: now,
              payoutReversalResolvedByAdminId: admin.id,
            };
      await prisma.$transaction(async (tx) => {
        const written = await tx.booking.updateMany({ where: { id, payoutStatus: "REVERSED", ...UNRESOLVED_REVERSAL } as never, data: data as never });
        if (written.count === 0) throw new ValidationError("This payout is not an open reversal.");
        await recordAdminAction(tx, audit(admin, "PAYOUT_REVERSAL_RESOLVED", id, { outcome: input.outcome, reason: input.reason }));
      });
      if (input.outcome === "WRITTEN_OFF") return { outcome: "WRITTEN_OFF", payoutStatus: "REVERSED", reason: null };
      const fresh = await loadBookingForWrite(id);
      const outcome = await settlement.executePayout(fresh, now);
      return { outcome: "RESENT", payoutStatus: outcome.payoutStatus, reason: outcome.reason };
    },

    /* ── C-PR5b — rapport mensuel par devise (5A) ────────────── */
    async getReport(monthsBack = 12): Promise<FinanceReport> {
      const now = clock();
      const months = Math.min(24, Math.max(1, Math.floor(monthsBack)));
      const from = monthStartUtc(now, months - 1);
      const to = monthStartUtc(now, -1);
      const gte = { gte: from };
      const [rows, live] = await Promise.all([
        prisma.booking.findMany({
          where: { isDeleted: false, OR: [{ capturedAt: gte }, { refundedAt: gte }, { payoutSentAt: gte }, { completedAt: gte }, { closedAt: gte }] } as never,
          select: MONEY_SELECT,
        }),
        prisma.booking.findMany({
          where: {
            isDeleted: false,
            OR: [{ payoutStatus: { in: ["PENDING", "FAILED", "FROZEN", "REVERSED"] } }, { status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" }, { manualRefundProposedCents: { gt: 0 } }],
          } as never,
          select: MONEY_SELECT,
        }),
      ]);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        generatedAt: now.toISOString(),
        months: buildFinanceReport(rows as unknown as MoneyRecord[], from, to),
        snapshot: buildFinanceSnapshot(live as unknown as MoneyRecord[]),
      };
    },

    /* ── C-PR5b — export CSV par deal, journalisé (5A) ───────── */
    async exportCsv(admin: AdminActor, from: Date, to: Date): Promise<{ csv: string; rows: number; filename: string }> {
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) throw new ValidationError("Invalid period.");
      if (to.getTime() - from.getTime() > EXPORT_MAX_DAYS * 86_400_000) throw new ValidationError(`The period cannot exceed ${EXPORT_MAX_DAYS} days.`);
      const gte = { gte: from };
      const rows = (await prisma.booking.findMany({
        where: { isDeleted: false, OR: [{ capturedAt: gte }, { refundedAt: gte }, { payoutSentAt: gte }, { completedAt: gte }, { closedAt: gte }] } as never,
        select: MONEY_SELECT,
        orderBy: { requestedAt: "asc" },
      })) as unknown as FinanceCsvRow[];
      const kept = rows.filter((r) => csvRowInRange(r, from, to));
      const filename = `yamba-finances-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`;
      // L'export porte des identifiants (personnes, paiements) : chaque export est journalisé.
      await recordAdminAction(prisma, audit(admin, "FINANCE_EXPORTED", null as unknown as string, { from: from.toISOString(), to: to.toISOString(), rows: kept.length, filename }));
      return { csv: buildFinanceCsv(kept), rows: kept.length, filename };
    },

    /* ── C-PR5b — remboursement manuel : proposer (3A-c) ─────── */
    async proposeManualRefund(admin: AdminActor, id: string, input: ManualRefundRequest): Promise<{ ok: true; proposedAt: string }> {
      const b = await loadMoney(id);
      assertNotParty(admin, b);
      const bounds = manualRefundBounds(b);
      if (!bounds.allowed) throw new ValidationError(bounds.reason ?? "This deal cannot be refunded.");
      if (input.amountCents > bounds.maxRefundableCents) throw new ValidationError(`At most ${bounds.maxRefundableCents} cents can still be refunded on this deal.`);
      const now = clock();
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id },
          data: { manualRefundProposedCents: input.amountCents, manualRefundProposedReason: input.reason, manualRefundProposedByAdminId: admin.id, manualRefundProposedAt: now },
        });
        await recordAdminAction(tx, audit(admin, "REFUND_MANUAL_PROPOSED", id, { amountCents: input.amountCents, reason: input.reason }));
      });
      return { ok: true, proposedAt: now.toISOString() };
    },

    /* ── C-PR5b — remboursement manuel : appliquer (SUPER_ADMIN) ─ */
    /**
     * D39 : l'argent d'abord (provider.refund), la base ensuite dans UNE transaction conditionnelle
     * (verrou sur le cumul déjà remboursé — deux admins ne remboursent pas deux fois), avec l'outbox
     * `booking.refund_issued` (l'Expéditeur reçoit l'email standard de remboursement) et le journal.
     * Un remboursement parti puis une base non écrite est visible au rapprochement (REFUND_NOT_RECORDED).
     */
    async applyManualRefund(admin: AdminActor, id: string, input: ManualRefundRequest): Promise<ManualRefundResponse> {
      const raw = await loadMoney(id);
      assertNotParty(admin, raw);
      const bounds = manualRefundBounds(raw);
      if (!bounds.allowed) throw new ValidationError(bounds.reason ?? "This deal cannot be refunded.");
      if (input.amountCents > bounds.maxRefundableCents) throw new ValidationError(`At most ${bounds.maxRefundableCents} cents can still be refunded on this deal.`);
      const booking: BookingForWrite = toBookingForWrite(raw as unknown as Record<string, unknown>);
      const now = clock();
      let refundId: string | null = null;
      try {
        refundId = (await provider.refund(raw.paymentIntentId!, input.amountCents)).refundId;
      } catch {
        throw new ValidationError("The refund could not be issued by the payment provider.");
      }
      const previous = raw.refundAmountCents ?? 0;
      const total = previous + input.amountCents;
      await applyBookingTransition({
        booking,
        from: raw.status as never,
        where: previous > 0 ? { refundAmountCents: previous } : { OR: [{ refundAmountCents: null }, { refundAmountCents: { isSet: false } }] },
        data: {
          refundAmountCents: total,
          refundedAt: now,
          refundId,
          manualRefundCents: input.amountCents,
          manualRefundReason: input.reason,
          manualRefundByAdminId: admin.id,
          manualRefundAt: now,
          manualRefundProposedCents: null,
          manualRefundProposedReason: null,
          manualRefundProposedByAdminId: null,
          manualRefundProposedAt: null,
        },
        releaseKg: false,
        events: [{ eventType: "booking.refund_issued", payload: { ...baseEventPayload(booking, "ADMIN"), amountCents: input.amountCents, refundedAt: now.toISOString() } }],
        now,
        conflictMessage: "This deal was refunded concurrently — check the money file before retrying.",
        within: async (tx) => {
          await recordAdminAction(tx, audit(admin, "REFUND_MANUAL_APPLIED", id, { amountCents: input.amountCents, totalRefundedCents: total, refundId, reason: input.reason }));
        },
      });
      return { bookingId: id, refundedCents: input.amountCents, totalRefundedCents: total, refundId, currencyCode: raw.pricing.currencyCode };
    },
  };
}

export type AdminFinanceService = ReturnType<typeof makeAdminFinanceService>;
