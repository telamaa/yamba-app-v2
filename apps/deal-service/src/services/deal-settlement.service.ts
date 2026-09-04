/**
 * deal-settlement.service.ts — B4 « argent sortant » : confirmer, verser, signaler
 * ===============================================================================
 * Emplacement : apps/deal-service/src/services/deal-settlement.service.ts
 *
 * Même rituel que deal-transport.service.ts (charger → machine → argent →
 * transaction + outbox), avec l'ordre INVERSE de D39 pour le versement :
 *
 *   D49 — COMPLETED D'ABORD, transfert ENSUITE. La transition DELIVERED →
 *   COMPLETED (confirmation anticipée de l'Expéditeur, ou cron J+4) écrit
 *   `payoutStatus = PENDING` + outbox `booking.completed` dans UNE
 *   transaction conditionnelle. Le transfert (`provider.transfer`, clé
 *   d'idempotence = id du booking, `source_transaction` = charge de la
 *   capture, A69) part juste après : succès → SENT + `booking.payout_sent`
 *   ; échec → FAILED + raison, rejoué par le cron (A65/A66, ≤ 10 essais).
 *   INV-2 tient par construction : aucun transfert avant COMPLETED.
 *
 *   D51 — litige : DELIVERED (avant `payoutDueAt`) ou PICKED_UP (« non
 *   livré », départ + 48 h — guard machine). Transaction : DISPUTED +
 *   `payoutStatus = FROZEN` (INV-5, DELIVERED seulement — rien n'était
 *   programmé en PICKED_UP) + ticket YAM-XXXX + création du `Dispute`
 *   (hook `within` de applyBookingTransition) + outbox `booking.disputed`.
 *   Collision de ticket (P2002) → nouveau tirage, 5 essais, puis 6 chiffres.
 *
 *   A70 — rappel J+3 : troisième passe du cron, une seule fois par deal
 *   (`verificationReminderSentAt`, écrit dans la transaction de l'outbox).
 */

import { randomInt } from "node:crypto";
import prisma from "@packages/libs/prisma";
import { Prisma } from "@prisma/client";
import { ForbiddenError, ValidationError } from "@packages/error-handler";
import type { PaymentProvider } from "@packages/payments";
import type {
  BookingActor,
  ConfirmDealResponse,
  DisputeDealRequest,
  DisputeDealResponse,
} from "@packages/api-contracts";
import { RATING_WINDOW_DAYS, canPerform, type BookingStatus, type BookingTransitionAction } from "./booking-state-machine";
import { recomputeBookingParties } from "./reputation.service";
import { BookingLifecycleError, baseEventPayload } from "./booking-lifecycle";
import {
  BOOKING_WRITE_SELECT,
  applyBookingTransition,
  loadBookingForWrite,
  toBookingForWrite,
  type BookingForWrite,
} from "./booking-write";

export type RequestingUser = { id: string };

/* ══ Paramètres serveur (B4) ══════════════════════════════════ */

/** Rejeux d'un versement FAILED par le cron (A65, décision 03/09 1B : 100) — au-delà, visible en base et dans le récapitulatif quotidien (A88).
 *  Le rejeu déclenché par `account.updated` (A87) ignore ce plafond. */
export const PAYOUT_MAX_ATTEMPTS = 100;
/** Récapitulatif support (A88) : un versement FAILED plus vieux que ce délai est signalé. */
export const OPS_DIGEST_FAILED_AFTER_HOURS = 24;
/** Rappel J+3 : émis quand il reste ≤ 24 h avant `payoutDueAt` (A70). */
export const VERIFICATION_REMINDER_HOURS_BEFORE = 24;
/** Tirages d'un ticket à 4 chiffres avant de passer à 6 (D51). */
export const DISPUTE_TICKET_ATTEMPTS = 5;
/** Compte Connect fictif du Fake : le transfert « part » toujours (A65). */
export const FAKE_CARRIER_ACCOUNT = "acct_fake_carrier";

export type PayoutOutcome = {
  payoutStatus: "SENT" | "FAILED";
  transferId: string | null;
  reason: string | null;
};

export type SettlementLogger = {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
};

const silentLogger: SettlementLogger = { info() {}, warn() {}, error() {} };

/** Ticket `YAM-` + 4 chiffres CSPRNG (6 après DISPUTE_TICKET_ATTEMPTS collisions — D51). */
export function generateDisputeTicket(attempt: number): string {
  const digits = attempt < DISPUTE_TICKET_ATTEMPTS ? randomInt(1000, 10_000) : randomInt(100_000, 1_000_000);
  return `YAM-${digits}`;
}

function isUniqueViolationOn(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  const targets = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  // Sans cible (mock, driver) : on considère que c'est le ticket — le
  // retirage est sans danger, la transaction a été annulée.
  return targets.length === 0 || targets.some((t) => t.includes(field));
}

/** Sous-ensemble machine : statut + guards B4 (échéance J+4, départ du trajet). */
function machineView(booking: BookingForWrite) {
  return {
    status: booking.status as BookingStatus,
    isDeleted: booking.isDeleted,
    expiresAt: booking.expiresAt,
    payoutDueAt: booking.payoutDueAt ?? null,
    departureAt: booking.trip.departureAt,
  };
}

export function makeDealSettlementService(
  provider: PaymentProvider,
  clock: () => Date = () => new Date(),
  logger: SettlementLogger = silentLogger
) {
  function assertTransition(
    booking: BookingForWrite,
    action: BookingTransitionAction,
    actor: BookingActor,
    now: Date
  ): { to: BookingStatus } {
    const check = canPerform(machineView(booking), action, actor, { now });
    if (!check.allowed) {
      throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", check.reason);
    }
    return { to: check.to };
  }

  function assertShipper(booking: BookingForWrite, user: RequestingUser, verb: string): void {
    if (booking.shipperId !== user.id) {
      // 403 et non 404 : le deal existe, l'appelant n'est pas l'Expéditeur.
      throw new ForbiddenError(`Only the shipper can ${verb} this deal.`);
    }
  }

  /* ── COMPLETED : la transaction (D49, étape 1) ───────────────── */

  async function completeBooking(booking: BookingForWrite, by: "SHIPPER" | "SYSTEM", now: Date): Promise<void> {
    await applyBookingTransition({
      booking,
      from: "DELIVERED",
      data: {
        status: "COMPLETED",
        completedAt: now,
        completedBy: by,
        payoutStatus: "PENDING",
        payoutAmountCents: booking.pricing.transportCents, // D50 — le net du snapshot
        payoutFailureReason: null,
        // B5/D53 — la fenêtre de notation s'ouvre à la fin de transaction.
        ratingWindowEndsAt: new Date(now.getTime() + RATING_WINDOW_DAYS * 86_400_000),
        ratingRemindersSent: 0,
      },
      releaseKg: false,
      events: [
        {
          eventType: "booking.completed",
          payload: { ...baseEventPayload(booking, by), completedAt: now.toISOString(), completedBy: by },
        },
      ],
      now,
    });
    // D29① — « deals terminés » est un fait de réputation : recalcul best-effort.
    await recomputeBookingParties(booking);
  }

  /* ── Le versement : l'exécuteur unique (A65) ─────────────────── */

  async function markPayoutFailed(booking: BookingForWrite, reason: string): Promise<PayoutOutcome> {
    await prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status as never },
      data: { payoutStatus: "FAILED", payoutFailureReason: reason, payoutAttempts: { increment: 1 } },
    });
    logger.warn({ bookingId: booking.id, reason }, "Carrier payout failed — will be retried by the payout cron");
    return { payoutStatus: "FAILED", transferId: null, reason };
  }

  async function resolveDestination(booking: BookingForWrite): Promise<string | null> {
    if (provider.name === "FAKE") return FAKE_CARRIER_ACCOUNT;
    const page = await prisma.carrierPage.findUnique({
      where: { userId: booking.carrierId },
      select: { stripeAccountId: true, stripePayoutsEnabled: true },
    });
    if (!page?.stripeAccountId || !page.stripePayoutsEnabled) return null;
    return page.stripeAccountId;
  }

  /**
   * Transfère le net (D50) vers le compte Connect du Voyageur et marque le
   * booking (COMPLETED requis — INV-2). Idempotent : même clé fournisseur,
   * écriture conditionnelle sur `payoutStatus ∈ {PENDING, FAILED}`.
   */
  async function executePayout(booking: BookingForWrite, now: Date): Promise<PayoutOutcome> {
    // INV-2 : le net à COMPLETED ; A80 : la compensation ANN-01 à CANCELLED (montant posé par l'annulation).
    if (booking.status !== "COMPLETED" && booking.status !== "CANCELLED") {
      throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "A payout requires a completed or late-cancelled deal.");
    }
    const reason = booking.status === "CANCELLED" ? "LATE_CANCELLATION" : "DELIVERY";
    // D50 : le net à COMPLETED ; A80 : la compensation à CANCELLED ; C-PR2 (D55) : le net ajusté
    // par une décision de médiation (net − remboursement partiel) — toujours `payoutAmountCents` quand il est posé.
    const amountCents = booking.payoutAmountCents ?? (booking.status === "COMPLETED" ? booking.pricing.transportCents : 0);
    if (amountCents <= 0) {
      throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "Nothing to pay out for this deal.");
    }
    const currencyCode = booking.pricing.currencyCode;

    const destination = await resolveDestination(booking);
    if (!destination) return markPayoutFailed(booking, "CARRIER_ACCOUNT_NOT_READY");

    let transferId: string;
    try {
      const result = await provider.transfer({
        amountCents,
        currencyCode,
        destinationAccountId: destination,
        description: reason === "DELIVERY" ? `Yamba — payout for deal ${booking.id}` : `Yamba — late cancellation compensation for deal ${booking.id}`,
        metadata: { bookingId: booking.id, tripId: booking.tripId, carrierId: booking.carrierId, reason },
        transferGroup: booking.id,
        sourceTransactionId: booking.chargeId ?? undefined, // A69
        idempotencyKey: `payout:${booking.id}`,
      });
      transferId = result.transferId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return markPayoutFailed(booking, `PROVIDER_ERROR:${message}`.slice(0, 500));
    }

    try {
      await applyBookingTransition({
        booking,
        from: booking.status as BookingStatus,
        where: { payoutStatus: { in: ["PENDING", "FAILED"] } },
        data: {
          payoutStatus: "SENT",
          transferId,
          payoutSentAt: now,
          payoutAmountCents: amountCents,
          payoutAttempts: (booking.payoutAttempts ?? 0) + 1,
          payoutFailureReason: null,
        },
        releaseKg: false,
        events: [
          {
            eventType: "booking.payout_sent",
            payload: { ...baseEventPayload(booking, "SYSTEM"), transferId, amountCents, reason },
          },
        ],
        now,
        conflictMessage: "This payout was already recorded.",
      });
    } catch (err) {
      // Course (deux exécuteurs sur le même deal) : le transfert est le
      // MÊME chez le fournisseur (clé d'idempotence) et l'autre a écrit.
      if (!(err instanceof BookingLifecycleError)) throw err;
      logger.info({ bookingId: booking.id, transferId }, "Payout already recorded by a concurrent run");
    }
    logger.info({ bookingId: booking.id, transferId, amountCents }, "Carrier payout sent");
    return { payoutStatus: "SENT", transferId, reason: null };
  }

  return {
    /* ── POST /deals/:id/confirm (INV-3 — définitif) ─────────── */
    async confirmEarly(user: RequestingUser, dealId: string): Promise<ConfirmDealResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertShipper(booking, user, "confirm the delivery of");
      assertTransition(booking, "confirmEarly", "SHIPPER", now);

      await completeBooking(booking, "SHIPPER", now);
      // A67 — le versement est tenté EN LIGNE : l'Expéditeur voit « libéré » ou « en cours ».
      const outcome = await executePayout({ ...booking, status: "COMPLETED", payoutAttempts: 0 }, now);

      return {
        bookingId: booking.id,
        status: "COMPLETED",
        completedAt: now.toISOString(),
        payoutStatus: outcome.payoutStatus,
        payoutAmountCents: booking.pricing.transportCents,
        currencyCode: booking.pricing.currencyCode,
      };
    },

    /* ── POST /deals/:id/dispute (INV-4 — irréversible) ──────── */
    async dispute(user: RequestingUser, dealId: string, input: DisputeDealRequest): Promise<DisputeDealResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertShipper(booking, user, "dispute");
      const from = booking.status as BookingStatus;
      assertTransition(booking, "dispute", "SHIPPER", now);

      if (from === "PICKED_UP" && input.category !== "NOT_DELIVERED") {
        // D51 — en transit, seul le « jamais livré » a un sens (le contenu
        // ne peut pas être constaté avant la remise).
        throw new ValidationError("While the parcel is in transit, only a NOT_DELIVERED dispute can be filed.", {
          errors: { category: "Must be NOT_DELIVERED while the parcel is in transit" },
        });
      }

      for (let attempt = 0; ; attempt += 1) {
        const ticketNumber = generateDisputeTicket(attempt);
        try {
          await applyBookingTransition({
            booking,
            from,
            data: {
              status: "DISPUTED",
              disputeTicket: ticketNumber,
              disputedAt: now,
              // INV-5 : gel — seulement quand un versement était programmé.
              ...(from === "DELIVERED" ? { payoutStatus: "FROZEN" } : {}),
            },
            releaseKg: false,
            events: [
              {
                eventType: "booking.disputed",
                payload: {
                  ...baseEventPayload(booking, "SHIPPER"),
                  ticketNumber,
                  disputedAt: now.toISOString(),
                  disputeCategory: input.category, // A68 — la catégorie voyage, jamais le dossier
                },
              },
            ],
            now,
            within: async (tx) => {
              await tx.dispute.create({
                data: {
                  bookingId: booking.id,
                  ticketNumber,
                  shipperId: booking.shipperId,
                  carrierId: booking.carrierId,
                  category: input.category,
                  description: input.description,
                  desiredOutcome: input.desiredOutcome ?? null,
                  photoUrls: input.photoUrls,
                  pledgeAcceptedAt: now,
                },
              });
            },
          });
          return { bookingId: booking.id, status: "DISPUTED", ticketNumber, disputedAt: now.toISOString() };
        } catch (err) {
          if (isUniqueViolationOn(err, "bookingId")) {
            // Un dossier existe déjà : la transition a été jouée entre-temps.
            throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "A dispute is already open for this deal.");
          }
          if (isUniqueViolationOn(err, "ticketNumber") && attempt < DISPUTE_TICKET_ATTEMPTS + 2) {
            continue; // collision de ticket : nouveau tirage (la transaction a été annulée)
          }
          throw err;
        }
      }
    },

    /* ── Cron J+4 (A66, passe 1) ─────────────────────────────── */

    /** DELIVERED dont l'échéance est passée → COMPLETED (SYSTEM) puis versement. Retourne le nombre complété. */
    async autoCompleteDue(batchSize = 50): Promise<number> {
      const now = clock();
      const due = await prisma.booking.findMany({
        where: { status: "DELIVERED", isDeleted: false, payoutDueAt: { lte: now } },
        select: BOOKING_WRITE_SELECT,
        take: batchSize,
        orderBy: { payoutDueAt: "asc" },
      });
      let completed = 0;
      for (const raw of due) {
        const booking = toBookingForWrite(raw as unknown as Record<string, unknown>);
        try {
          assertTransition(booking, "autoComplete", "SYSTEM", now);
          await completeBooking(booking, "SYSTEM", now);
          completed += 1;
          await executePayout({ ...booking, status: "COMPLETED", payoutAttempts: 0 }, now);
        } catch (err) {
          // Course (confirmé / disputé entre le findMany et la transaction) : on passe au suivant.
          logger.info({ bookingId: booking.id, err: err instanceof Error ? err.message : err }, "Auto-complete skipped");
        }
      }
      return completed;
    },

    /* ── Rejeu des versements FAILED (A66, passe 2) ──────────── */

    async retryFailedPayouts(batchSize = 50): Promise<number> {
      const now = clock();
      // A80 : les compensations d'annulation tardive (CANCELLED) rejouent avec le même exécuteur ;
      // PENDING couvre un crash entre la transition et le transfert en ligne (idempotent).
      const failed = await prisma.booking.findMany({
        where: {
          status: { in: ["COMPLETED", "CANCELLED"] },
          isDeleted: false,
          payoutStatus: { in: ["PENDING", "FAILED"] },
          payoutAttempts: { lt: PAYOUT_MAX_ATTEMPTS },
        },
        select: BOOKING_WRITE_SELECT,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      let sent = 0;
      for (const raw of failed) {
        const booking = toBookingForWrite(raw as unknown as Record<string, unknown>);
        try {
          const outcome = await executePayout(booking, now);
          if (outcome.payoutStatus === "SENT") sent += 1;
        } catch (err) {
          logger.error({ bookingId: booking.id, err }, "Payout retry failed unexpectedly");
        }
      }
      return sent;
    },

    /* ── Rappel J+3 (A70, passe 3) ───────────────────────────── */

    async sendVerificationReminders(batchSize = 50): Promise<number> {
      const now = clock();
      const horizon = new Date(now.getTime() + VERIFICATION_REMINDER_HOURS_BEFORE * 3_600_000);
      // Pitfall Mongo : `null` ne matche pas un champ ABSENT → OR isSet.
      const notSent = { OR: [{ verificationReminderSentAt: null }, { verificationReminderSentAt: { isSet: false } }] };
      const soon = await prisma.booking.findMany({
        where: { status: "DELIVERED", isDeleted: false, payoutDueAt: { gt: now, lte: horizon }, ...notSent },
        select: BOOKING_WRITE_SELECT,
        take: batchSize,
        orderBy: { payoutDueAt: "asc" },
      });
      let reminded = 0;
      for (const raw of soon) {
        const booking = toBookingForWrite(raw as unknown as Record<string, unknown>);
        if (!booking.payoutDueAt) continue;
        try {
          await applyBookingTransition({
            booking,
            from: "DELIVERED",
            where: notSent,
            data: { verificationReminderSentAt: now },
            releaseKg: false,
            events: [
              {
                eventType: "booking.verification_reminder",
                payload: { ...baseEventPayload(booking, "SYSTEM"), payoutDueAt: new Date(booking.payoutDueAt).toISOString() },
              },
            ],
            now,
            conflictMessage: "Reminder already sent.",
          });
          reminded += 1;
        } catch (err) {
          logger.info({ bookingId: booking.id, err: err instanceof Error ? err.message : err }, "Verification reminder skipped");
        }
      }
      return reminded;
    },

    /* ── Webhook Connect `account.updated` (A87) ─────────────── */

    /**
     * Le compte Stripe du Voyageur vient d'être déclaré prêt : rejoue SES
     * versements FAILED immédiatement, quel que soit le compteur d'essais
     * (le plafond A65 ne vaut que pour le cron). Retourne le nombre envoyé.
     */
    async retryPayoutsForCarrier(carrierId: string): Promise<number> {
      const now = clock();
      const failed = await prisma.booking.findMany({
        where: { carrierId, isDeleted: false, status: { in: ["COMPLETED", "CANCELLED"] }, payoutStatus: "FAILED" },
        select: BOOKING_WRITE_SELECT,
        orderBy: { updatedAt: "asc" },
      });
      let sent = 0;
      for (const raw of failed) {
        const booking = toBookingForWrite(raw as unknown as Record<string, unknown>);
        try {
          if ((await executePayout(booking, now)).payoutStatus === "SENT") sent += 1;
        } catch (err) {
          logger.error({ bookingId: booking.id, err }, "Payout retry (account.updated) failed unexpectedly");
        }
      }
      return sent;
    },

    /* ── Webhook `transfer.reversed` (A87) ───────────────────── */

    /** Stripe a renversé un transfert : l'argent est revenu à la plateforme. JAMAIS renvoyé automatiquement (arbitrage admin). */
    async markTransferReversed(transferId: string): Promise<boolean> {
      const written = await prisma.booking.updateMany({
        where: { transferId, payoutStatus: "SENT" },
        data: { payoutStatus: "REVERSED", payoutFailureReason: "PROVIDER_REVERSED" },
      });
      if (written.count > 0) logger.warn({ transferId }, "Stripe transfer reversed — payout marked REVERSED (admin review)");
      return written.count > 0;
    },

    /* ── Récapitulatif quotidien support (A88) ───────────────── */

    /** Ce que le support doit regarder : échecs > 24 h, renversés, retenues à arbitrer. */
    async collectOpsDigest(): Promise<{
      failed: BookingForWrite[];
      reversed: BookingForWrite[];
      held: BookingForWrite[];
    }> {
      const now = clock();
      const since = new Date(now.getTime() - OPS_DIGEST_FAILED_AFTER_HOURS * 3_600_000);
      const load = (where: Record<string, unknown>) =>
        prisma.booking.findMany({ where: { isDeleted: false, ...where } as never, select: BOOKING_WRITE_SELECT, take: 100, orderBy: { updatedAt: "asc" } });
      const [failed, reversed, held] = await Promise.all([
        load({ status: { in: ["COMPLETED", "CANCELLED"] }, payoutStatus: "FAILED", updatedAt: { lt: since } }),
        load({ payoutStatus: "REVERSED" }),
        load({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" }),
      ]);
      const conv = (rows: unknown[]) => rows.map((r) => toBookingForWrite(r as Record<string, unknown>));
      return { failed: conv(failed), reversed: conv(reversed), held: conv(held) };
    },

    /** Exposé pour la PR retenue ANN-01 (D50) et les tests. */
    executePayout,
  };
}

export type DealSettlementService = ReturnType<typeof makeDealSettlementService>;
