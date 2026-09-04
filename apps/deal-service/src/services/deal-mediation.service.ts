/**
 * deal-mediation.service.ts — médiation d'un litige et arbitrage d'une retenue (C-PR2, D55)
 * =========================================================================================
 * Trois gestes :
 *   - `respond`          (Voyageur) : sa version, une fois, pendant que le dossier est OPEN ;
 *   - `resolveDispute`   (ADMIN)    : rejet / partiel / total — l'argent D'ABORD (remboursement),
 *                                     puis UNE transaction (transition + dossier + compteur + journal
 *                                     + outbox), puis le transfert par l'exécuteur unique (D49) ;
 *   - `resolveRetention` (ADMIN)    : compensation (prorata A79) ou restitution de la retenue.
 * Les règles d'argent et de délai sont des fonctions PURES testées à part.
 */
import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import type { PaymentProvider } from "@packages/payments";
import { recordAdminAction } from "@packages/admin-audit";
import {
  DISPUTE_RESPONSE_DELAY_HOURS,
  BookingDomainEventSchema,
  type AdminResolutionResponse,
  type AdminResolveDisputeRequest,
  type AdminResolveRetentionRequest,
  type CarrierDisputeStatementRequest,
  type CarrierDisputeStatementResponse,
  type DisputeResolutionOutcome,
} from "@packages/api-contracts";
import { canPerform, type BookingStatus } from "./booking-state-machine";
import { BookingLifecycleError, baseEventPayload, computeLateCancellationCompensationCents } from "./booking-lifecycle";
import { applyBookingTransition, loadBookingForWrite, makeEnvelope, type BookingForWrite } from "./booking-write";
import { recomputeBookingParties } from "./reputation.service";
import type { PayoutExecutor } from "./deal-lifecycle.service";

export type RequestingUser = { id: string };
export type AdminActor = { id: string; ip?: string | null; userAgent?: string | null };

/* ══ Règles pures ═════════════════════════════════════════════ */

export type ResolutionMoney = { refundCents: number; carrierPayoutCents: number; yambaKeepsCents: number };

/**
 * Les flux d'une décision (D54 3A) :
 *   REJECTED       → 0 remboursé, net entier au Voyageur, commission conservée ;
 *   PARTIAL_REFUND → X remboursé (1 ≤ X ≤ total − 1), Voyageur = net − X plancher 0, Yamba garde le reste ;
 *   FULL_REFUND    → tout remboursé, commission comprise, Voyageur 0.
 */
export function computeResolutionMoney(
  outcome: DisputeResolutionOutcome,
  refundCents: number | undefined,
  pricing: { totalShipperCents: number; transportCents: number }
): ResolutionMoney {
  const total = pricing.totalShipperCents;
  const net = pricing.transportCents;
  if (outcome === "REJECTED") return { refundCents: 0, carrierPayoutCents: net, yambaKeepsCents: total - net };
  if (outcome === "FULL_REFUND") return { refundCents: total, carrierPayoutCents: 0, yambaKeepsCents: 0 };
  if (refundCents === undefined || !Number.isInteger(refundCents) || refundCents < 1 || refundCents > total - 1) {
    throw new ValidationError("A partial refund must be between 1 cent and the total minus 1 cent.", {
      errors: { refundCents: `1 ≤ refundCents ≤ ${total - 1}` },
    });
  }
  const carrierPayoutCents = Math.max(0, net - refundCents);
  return { refundCents, carrierPayoutCents, yambaKeepsCents: total - refundCents - carrierPayoutCents };
}

export function disputeResponseDeadline(disputedAt: Date): Date {
  return new Date(disputedAt.getTime() + DISPUTE_RESPONSE_DELAY_HOURS * 3_600_000);
}

/** Décision possible : le Voyageur a répondu, ou le délai est passé (D55 1A). */
export function isDisputeDecidable(d: { disputedAt: Date; carrierRespondedAt: Date | null }, now: Date): boolean {
  return d.carrierRespondedAt !== null || now.getTime() >= disputeResponseDeadline(d.disputedAt).getTime();
}

/** Qui « perd » un litige (D55 4A) : l'Expéditeur si rejet, le Voyageur dès qu'il y a remboursement. */
export function disputeLoser(outcome: DisputeResolutionOutcome): "SHIPPER" | "CARRIER" {
  return outcome === "REJECTED" ? "SHIPPER" : "CARRIER";
}

/** C-PR3 (D56) — conflit d'intérêts : un admin ne tranche jamais un deal dont il est partie. */
export function assertNotParty(admin: { id: string }, booking: { shipperId: string; carrierId: string }): void {
  if (admin.id === booking.shipperId || admin.id === booking.carrierId) {
    throw new ForbiddenError("You are a party to this deal: another admin must decide.");
  }
}

/* ══ Service ══════════════════════════════════════════════════ */

type DisputeRow = {
  id: string;
  bookingId: string;
  ticketNumber: string;
  status: string;
  carrierRespondedAt: Date | null;
  resolvedAt: Date | null;
};

export function makeDealMediationService(
  provider: PaymentProvider,
  payoutExecutor: PayoutExecutor | null = null,
  clock: () => Date = () => new Date()
) {
  async function loadDispute(bookingId: string): Promise<DisputeRow> {
    const d = await prisma.dispute.findUnique({
      where: { bookingId },
      select: { id: true, bookingId: true, ticketNumber: true, status: true, carrierRespondedAt: true, resolvedAt: true },
    });
    if (!d) throw new NotFoundError("Deal not found.");
    return d;
  }

  async function auditedOutbox(
    tx: typeof prisma,
    booking: BookingForWrite,
    eventType: string,
    payload: Record<string, unknown>,
    now: Date
  ): Promise<void> {
    const envelope = makeEnvelope(booking.id, now);
    const parsed = BookingDomainEventSchema.parse({ ...envelope, eventType, payload });
    await tx.outboxEvent.create({
      data: { aggregateType: "booking", aggregateId: booking.id, eventType, payload: parsed as never, occurredAt: now, publishedAt: null },
    });
  }

  return {
    /* ── POST /deals/:id/dispute/statement (Voyageur) ─────────── */
    async respond(user: RequestingUser, dealId: string, input: CarrierDisputeStatementRequest): Promise<CarrierDisputeStatementResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      if (booking.carrierId !== user.id) throw new ForbiddenError("Only the carrier can answer this dispute.");
      if (booking.status !== "DISPUTED") throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This deal is not under dispute.");
      const dispute = await loadDispute(booking.id);
      if (dispute.carrierRespondedAt || dispute.status !== "OPEN") {
        throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "Your statement was already recorded.");
      }
      await prisma.$transaction(async (tx) => {
        const updated = await tx.dispute.updateMany({
          where: { id: dispute.id, status: "OPEN" },
          data: { carrierStatement: input.statement, carrierStatementPhotoUrls: input.photoUrls, carrierRespondedAt: now, status: "CARRIER_RESPONDED" },
        });
        if (updated.count === 0) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "Your statement was already recorded.");
        await auditedOutbox(
          tx as typeof prisma,
          booking,
          "booking.dispute_carrier_responded",
          { ...baseEventPayload(booking, "CARRIER"), ticketNumber: dispute.ticketNumber, respondedAt: now.toISOString() },
          now
        );
      });
      return { bookingId: booking.id, ticketNumber: dispute.ticketNumber, respondedAt: now.toISOString() };
    },

    /* ── POST /admin/disputes/:id/resolve ─────────────────────── */
    async resolveDispute(admin: AdminActor, dealId: string, input: AdminResolveDisputeRequest): Promise<AdminResolutionResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertNotParty(admin, booking);
      const action = input.outcome === "FULL_REFUND" ? "resolveDisputeRefund" : "resolveDisputeKeep";
      const check = canPerform(
        { ...booking, status: booking.status as BookingStatus, departureAt: booking.trip.departureAt } as Parameters<typeof canPerform>[0],
        action,
        "ADMIN",
        { now }
      );
      if (!check.allowed) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", check.reason);
      const dispute = await loadDispute(booking.id);
      if (dispute.resolvedAt) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This dispute was already decided.");
      if (!booking.disputedAt) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This dispute has no opening date.");
      if (!isDisputeDecidable({ disputedAt: booking.disputedAt, carrierRespondedAt: dispute.carrierRespondedAt }, now)) {
        throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "The carrier still has time to answer (72h after the dispute was filed).", {
          decidableAt: disputeResponseDeadline(booking.disputedAt).toISOString(),
        });
      }

      const money = computeResolutionMoney(input.outcome, input.refundCents, booking.pricing);

      // D39 — l'argent d'abord : le remboursement part avant la base (comme l'annulation).
      let refundId: string | null = null; // C-PR5 (D58)
      if (money.refundCents > 0) {
        if (!booking.paymentIntentId) throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "This deal has no payment to refund.");
        try {
          refundId = (await provider.refund(booking.paymentIntentId, money.refundCents)).refundId;
        } catch {
          throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "The refund could not be issued.");
        }
      }

      const finalStatus = check.to as "COMPLETED" | "CANCELLED";
      const loser = disputeLoser(input.outcome);
      const previousRefund = booking.refundAmountCents ?? 0;
      await applyBookingTransition({
        booking,
        from: "DISPUTED",
        data:
          finalStatus === "COMPLETED"
            ? {
                status: "COMPLETED",
                completedAt: now,
                completedBy: "ADMIN",
                payoutStatus: money.carrierPayoutCents > 0 ? "PENDING" : null,
                payoutAmountCents: money.carrierPayoutCents,
                payoutFailureReason: null,
                ...(money.refundCents > 0 ? { refundedAt: now, refundAmountCents: previousRefund + money.refundCents, refundId } : {}),
                // D54 4B — aucune fenêtre de notation après un litige.
                ratingWindowEndsAt: null,
              }
            : {
                status: "CANCELLED",
                closedAt: now,
                closedBy: "ADMIN",
                cancelReason: "DISPUTE_FULL_REFUND",
                payoutStatus: null,
                payoutAmountCents: 0,
                refundedAt: now,
                refundAmountCents: previousRefund + money.refundCents,
                refundId,
              },
        releaseKg: finalStatus === "CANCELLED",
        events: [
          {
            eventType: "booking.dispute_resolved",
            payload: {
              ...baseEventPayload(booking, "ADMIN"),
              kind: "DISPUTE",
              ticketNumber: dispute.ticketNumber,
              outcome: input.outcome,
              refundCents: money.refundCents,
              carrierPayoutCents: money.carrierPayoutCents,
              reason: input.reason,
              finalStatus,
              resolvedAt: now.toISOString(),
            },
          },
        ],
        now,
        conflictMessage: "This dispute was already decided.",
        within: async (tx) => {
          // Pitfall Mongo (5e occurrence, A85) : `resolvedAt: null` ne matche PAS un champ ABSENT —
          // les dossiers créés avant C-PR2 n'ont pas le champ. Toujours la forme null OU isSet:false.
          const updated = await tx.dispute.updateMany({
            where: { id: dispute.id, OR: [{ resolvedAt: null }, { resolvedAt: { isSet: false } }] },
            data: {
              status: "RESOLVED",
              resolutionOutcome: input.outcome,
              resolutionRefundCents: money.refundCents,
              resolutionCarrierPayoutCents: money.carrierPayoutCents,
              resolutionReason: input.reason,
              resolvedByAdminId: admin.id,
              resolvedAt: now,
            },
          });
          if (updated.count === 0) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This dispute was already decided.");
          // D55 4A — fait INTERNE de réputation sur la partie condamnée.
          // Pitfall Mongo : `increment` sur un champ ABSENT donne null — on lit puis on écrit la valeur.
          if (loser === "SHIPPER") {
            const u = await tx.user.findUnique({ where: { id: booking.shipperId }, select: { shipperDisputesLostCount: true } });
            await tx.user.update({ where: { id: booking.shipperId }, data: { shipperDisputesLostCount: (u?.shipperDisputesLostCount ?? 0) + 1 } });
          } else {
            const page = await tx.carrierPage.findUnique({ where: { userId: booking.carrierId }, select: { id: true, disputesLostCount: true } });
            if (page) await tx.carrierPage.update({ where: { id: page.id }, data: { disputesLostCount: (page.disputesLostCount ?? 0) + 1 } });
          }
          await recordAdminAction(tx, {
            adminUserId: admin.id,
            action: "DISPUTE_RESOLVED",
            targetType: "BOOKING",
            targetId: booking.id,
            before: { status: "DISPUTED", ticketNumber: dispute.ticketNumber },
            after: { finalStatus, outcome: input.outcome, refundCents: money.refundCents, carrierPayoutCents: money.carrierPayoutCents },
            ip: admin.ip,
            userAgent: admin.userAgent,
          });
        },
      });

      // D49 — le transfert par l'exécuteur unique, APRÈS la transaction ; un échec devient FAILED (rejoué par le cron).
      let payoutStatus: string | null = null;
      if (money.carrierPayoutCents > 0 && payoutExecutor) {
        try {
          const outcome = (await payoutExecutor.executePayout(
            { ...booking, status: "COMPLETED", payoutStatus: "PENDING", payoutAmountCents: money.carrierPayoutCents, payoutAttempts: 0 },
            now
          )) as { payoutStatus?: string } | undefined;
          payoutStatus = outcome?.payoutStatus ?? "PENDING";
        } catch {
          payoutStatus = "FAILED";
        }
      } else if (money.carrierPayoutCents > 0) {
        payoutStatus = "PENDING";
      }
      // D29① — un deal terminé (ou annulé par décision) est un fait de réputation : recalcul best-effort.
      await recomputeBookingParties(booking);

      return {
        bookingId: booking.id,
        kind: "DISPUTE",
        finalStatus,
        outcome: input.outcome,
        refundCents: money.refundCents,
        carrierPayoutCents: money.carrierPayoutCents,
        payoutStatus,
        resolvedAt: now.toISOString(),
      };
    },

    /* ── POST /admin/disputes/:id/retention ───────────────────── */
    async resolveRetention(admin: AdminActor, dealId: string, input: AdminResolveRetentionRequest): Promise<AdminResolutionResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertNotParty(admin, booking);
      if (booking.status !== "CANCELLED" || booking.retentionDisposition !== "HELD_FOR_MEDIATION") {
        throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This deal has no retention awaiting arbitration.");
      }
      const retentionCents = booking.retentionCents ?? 0;
      if (retentionCents <= 0) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "Nothing is retained on this deal.");

      const compensateCents =
        input.outcome === "COMPENSATE_CARRIER"
          ? computeLateCancellationCompensationCents({
              retentionCents,
              transportCents: booking.pricing.transportCents,
              totalShipperCents: booking.pricing.totalShipperCents,
            })
          : 0;
      const restituteCents = input.outcome === "RESTITUTE_SHIPPER" ? retentionCents : 0;

      let restituteRefundId: string | null = null; // C-PR5 (D58)
      if (restituteCents > 0) {
        if (!booking.paymentIntentId) throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "This deal has no payment to refund.");
        try {
          restituteRefundId = (await provider.refund(booking.paymentIntentId, restituteCents)).refundId;
        } catch {
          throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "The refund could not be issued.");
        }
      }

      const previousRefund = booking.refundAmountCents ?? 0;
      await applyBookingTransition({
        booking,
        from: "CANCELLED",
        where: { retentionDisposition: "HELD_FOR_MEDIATION" },
        data: {
          retentionDisposition: input.outcome === "COMPENSATE_CARRIER" ? "CARRIER" : "SHIPPER",
          retentionDecisionReason: input.reason,
          retentionDecidedAt: now,
          retentionDecidedByAdminId: admin.id,
          ...(compensateCents > 0 ? { payoutStatus: "PENDING", payoutAmountCents: compensateCents, payoutFailureReason: null } : {}),
          ...(restituteCents > 0 ? { refundedAt: now, refundAmountCents: previousRefund + restituteCents, refundId: restituteRefundId } : {}),
        },
        releaseKg: false,
        events: [
          {
            eventType: "booking.dispute_resolved",
            payload: {
              ...baseEventPayload(booking, "ADMIN"),
              kind: "RETENTION",
              ticketNumber: null,
              outcome: input.outcome,
              refundCents: restituteCents,
              carrierPayoutCents: compensateCents,
              reason: input.reason,
              finalStatus: "CANCELLED",
              resolvedAt: now.toISOString(),
            },
          },
        ],
        now,
        conflictMessage: "This retention was already arbitrated.",
        within: async (tx) => {
          await recordAdminAction(tx, {
            adminUserId: admin.id,
            action: "RETENTION_ARBITRATED",
            targetType: "BOOKING",
            targetId: booking.id,
            before: { retentionDisposition: "HELD_FOR_MEDIATION", retentionCents },
            after: { outcome: input.outcome, refundCents: restituteCents, carrierPayoutCents: compensateCents },
            ip: admin.ip,
            userAgent: admin.userAgent,
          });
        },
      });

      let payoutStatus: string | null = null;
      if (compensateCents > 0 && payoutExecutor) {
        try {
          const outcome = (await payoutExecutor.executePayout(
            { ...booking, status: "CANCELLED", payoutStatus: "PENDING", payoutAmountCents: compensateCents, payoutAttempts: 0 },
            now
          )) as { payoutStatus?: string } | undefined;
          payoutStatus = outcome?.payoutStatus ?? "PENDING";
        } catch {
          payoutStatus = "FAILED";
        }
      } else if (compensateCents > 0) {
        payoutStatus = "PENDING";
      }

      return {
        bookingId: booking.id,
        kind: "RETENTION",
        finalStatus: "CANCELLED",
        outcome: input.outcome,
        refundCents: restituteCents,
        carrierPayoutCents: compensateCents,
        payoutStatus,
        resolvedAt: now.toISOString(),
      };
    },
  };
}
export type DealMediationService = ReturnType<typeof makeDealMediationService>;
