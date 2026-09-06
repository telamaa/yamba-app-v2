/**
 * deal-lifecycle.service.ts — accept / decline / cancel / expire / webhook (B2-PR2)
 * =================================================================================
 * Emplacement : apps/deal-service/src/services/deal-lifecycle.service.ts
 *
 * Chaque transition suit le MÊME rituel :
 *   1. Charger le booking, vérifier que l'appelant y est partie (403).
 *   2. Demander à la booking-state-machine (canPerform) — jamais une
 *      décision dans un controller : refus ⇒ 409 TRANSITION_NOT_ALLOWED
 *      avec la raison de la machine.
 *   3. L'ARGENT d'abord (D39) : capture / cancel / refund chez le
 *      PaymentProvider AVANT d'écrire — entre notre base et le
 *      fournisseur, c'est lui qui a l'argent.
 *   4. La BASE ensuite : UNE transaction Mongo — updateMany CONDITIONNEL
 *      sur le statut attendu (deux clics concurrents : un seul gagne),
 *      restitution des kg (CAP-02) si l'effet le déclare, événements
 *      outbox validés au contrat AVANT écriture (D2).
 *   5. Compensation best-effort si la base refuse après une capture
 *      (rarissime : course accept/decline) + filet webhook D40.
 *
 * B3-PR1 : le chargement et la transaction commune vivent dans
 * booking-write.ts (partagés avec deal-transport.service.ts).
 *
 * Gate D31 : le profil Voyageur + Stripe Connect sont exigés À
 * L'ACCEPTATION (plus à la publication — les 2 checks du trip-service
 * sont retirés dans cette même PR). Sauté avec le FakePaymentProvider
 * (dev sans clés — le Fake est déjà refusé en production).
 */

import prisma from "@packages/libs/prisma";
import { ForbiddenError } from "@packages/error-handler";
import type { PaymentProvider } from "@packages/payments";
import type {
  AcceptDealRequest,
  BookingActor,
  CancelDealRequest,
  DealTransitionResponse,
  DeclineDealRequest,
} from "@packages/api-contracts";
import {
  canPerform,
  type BookingEffect,
  type BookingStatus,
  type BookingTransitionAction,
} from "./booking-state-machine";
import {
  BookingLifecycleError,
  baseEventPayload,
  computeCancellationRefundCents,
  computeLateCancellationCompensationCents,
} from "./booking-lifecycle";
import {
  BOOKING_WRITE_SELECT,
  applyBookingTransition,
  loadBookingForWrite,
  toBookingForWrite,
  type BookingForWrite,
} from "./booking-write";
import { recomputeBookingParties } from "./reputation.service";
import { cancellationParamsFromSettings } from "./booking-lifecycle";
import { platformSettings } from "@packages/libs/settings/default";
import type { SettingsReader } from "@packages/libs/settings";

export type RequestingUser = { id: string };

/* ══ Chargement / transaction : voir booking-write.ts (partagé avec
      deal-transport.service.ts depuis B3-PR1) ═══════════════════ */

type BookingForLifecycle = BookingForWrite;
const loadBooking = loadBookingForWrite;
const BOOKING_SELECT = BOOKING_WRITE_SELECT;

/** Exécuteur de versement (A65) — injecté pour la compensation d'annulation tardive (A80). */
export type PayoutExecutor = {
  executePayout(booking: BookingForWrite, now: Date): Promise<unknown>;
};

export function makeDealLifecycleService(
  provider: PaymentProvider,
  clock: () => Date = () => new Date(),
  payoutExecutor: PayoutExecutor | null = null,
  settings: SettingsReader = platformSettings()
) {
  /** La machine a-t-elle dit oui ? Sinon 409 avec SA raison. */
  function assertTransition(
    booking: BookingForLifecycle,
    action: BookingTransitionAction,
    actor: BookingActor,
    now: Date
  ): { to: BookingStatus; effects: readonly BookingEffect[] } {
    const check = canPerform(
      { status: booking.status as BookingStatus, isDeleted: booking.isDeleted, expiresAt: booking.expiresAt },
      action,
      actor,
      { now }
    );
    if (!check.allowed) {
      throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", check.reason);
    }
    return { to: check.to, effects: check.effects };
  }

  function transitionResponse(
    booking: BookingForLifecycle,
    status: BookingStatus,
    refundAmountCents: number | null
  ): DealTransitionResponse {
    return {
      bookingId: booking.id,
      status,
      refundAmountCents,
      currencyCode: booking.pricing.currencyCode,
    };
  }

  /** Libère l'empreinte (best effort : elle expirerait seule — filet D40). */
  async function releaseAuthorization(paymentIntentId: string | null): Promise<void> {
    if (!paymentIntentId) return;
    try {
      await provider.cancel(paymentIntentId, "requested_by_customer");
    } catch {
      // Course avec accept (déjà capturé) ou intent déjà annulé : Stripe
      // tranche, le webhook D40 réconcilie. Rien à faire ici.
    }
  }

  return {
    /* ── POST /deals/:id/accept ─────────────────────────────── */
    async accept(user: RequestingUser, dealId: string, _input: AcceptDealRequest): Promise<DealTransitionResponse> {
      const now = clock();
      const booking = await loadBooking(dealId);
      if (booking.carrierId !== user.id) {
        // 403 et non 404 : le deal existe, l'appelant n'est pas le Voyageur.
        throw new ForbiddenError("Only the carrier can accept this deal.");
      }
      const { to } = assertTransition(booking, "accept", "CARRIER", now);

      // ── Gate D31 : profil + Stripe exigés au moment où l'argent est réel.
      // Sauté avec le Fake (dev sans clés — refusé en production de toute façon).
      if (provider.name !== "FAKE") {
        const carrierPage = await prisma.carrierPage.findUnique({
          where: { userId: booking.carrierId },
          select: { onboardingStep: true, stripeOnboardingComplete: true, stripeChargesEnabled: true },
        });
        if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
          throw new BookingLifecycleError(
            "CARRIER_ONBOARDING_REQUIRED",
            "Complete your carrier profile to accept this deal."
          );
        }
        if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
          throw new BookingLifecycleError(
            "CARRIER_ONBOARDING_REQUIRED",
            "Finish your Stripe onboarding to accept this deal."
          );
        }
      }

      // ── L'empreinte est-elle toujours vivante ? (elle peut mourir seule)
      if (!booking.paymentIntentId) {
        throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "This deal has no payment authorization.");
      }
      let auth;
      try {
        auth = await provider.retrieve(booking.paymentIntentId);
      } catch {
        throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "Unknown payment authorization.");
      }
      if (auth.status !== "AUTHORIZED") {
        throw new BookingLifecycleError(
          "PAYMENT_STATE_CONFLICT",
          "The shipper's payment can no longer be captured.",
          { paymentStatus: auth.status }
        );
      }

      // ── D39 : capture MAINTENANT (l'argent d'abord, la base ensuite).
      let captured;
      try {
        captured = await provider.capture(booking.paymentIntentId);
      } catch {
        throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "The payment could not be captured.");
      }

      try {
        await applyBookingTransition({
          booking,
          from: "PENDING",
          // A69 — la charge de la capture sert de `source_transaction` au versement B4.
          data: { status: to, acceptedAt: now, capturedAt: now, chargeId: captured.chargeId ?? null },
          releaseKg: false,
          events: [
            {
              eventType: "booking.accepted",
              payload: { ...baseEventPayload(booking, "CARRIER"), acceptedAt: now.toISOString() },
            },
          ],
          now,
        });
      } catch (e) {
        // Capturé mais transition perdue (course decline/cancel/expire —
        // rarissime : ces chemins annulent l'intent AVANT d'écrire, donc la
        // capture aurait échoué). On rend l'argent, best effort.
        await provider.refund(booking.paymentIntentId).catch(() => undefined);
        throw e;
      }

      return transitionResponse(booking, to, null);
    },

    /* ── POST /deals/:id/decline ────────────────────────────── */
    async decline(user: RequestingUser, dealId: string, input: DeclineDealRequest): Promise<DealTransitionResponse> {
      const now = clock();
      const booking = await loadBooking(dealId);
      if (booking.carrierId !== user.id) {
        throw new ForbiddenError("Only the carrier can decline this deal.");
      }
      const { to } = assertTransition(booking, "decline", "CARRIER", now);

      // FULL_REFUND d'un PENDING = libération de l'empreinte (jamais capturée).
      await releaseAuthorization(booking.paymentIntentId);

      const total = booking.pricing.totalShipperCents;
      await applyBookingTransition({
        booking,
        from: "PENDING",
        data: { status: to, closedAt: now, closedBy: "CARRIER", declineReason: input.reason ?? null },
        releaseKg: true,
        events: [
          {
            eventType: "booking.declined",
            payload: {
              ...baseEventPayload(booking, "CARRIER"),
              reason: input.reason ?? null,
              closedAt: now.toISOString(),
            },
          },
          {
            eventType: "booking.refund_issued",
            payload: {
              ...baseEventPayload(booking, "CARRIER"),
              amountCents: total,
              refundedAt: now.toISOString(),
            },
          },
        ],
        now,
      });

      return transitionResponse(booking, to, total);
    },

    /* ── POST /deals/:id/cancel (Expéditeur — ANN-01) ───────── */
    async cancel(user: RequestingUser, dealId: string, input: CancelDealRequest): Promise<DealTransitionResponse> {
      const now = clock();
      const booking = await loadBooking(dealId);
      if (booking.shipperId !== user.id) {
        throw new ForbiddenError("Only the shipper can cancel this deal.");
      }
      const { to, effects } = assertTransition(booking, "cancel", "SHIPPER", now);
      const wasAccepted = effects.includes("REFUND_PER_CANCELLATION_POLICY");

      let refundAmountCents: number;
      let refundId: string | null = null; // C-PR5 (D58)
      // D50 (A79–A81) — la retenue ANN-01 et son sort.
      let retention: {
        retentionCents: number;
        retentionDisposition: "CARRIER" | "HELD_FOR_MEDIATION";
        compensationCents: number;
      } | null = null;
      if (wasAccepted) {
        // ANN-01 (D39) : le paiement est CAPTURÉ — vrai remboursement,
        // 100 % jusqu'à J-2, sinon retenue 50 % (versée au Voyageur en B4).
        refundAmountCents = computeCancellationRefundCents({
          totalShipperCents: booking.pricing.totalShipperCents,
          departureAt: booking.trip.departureAt,
          now,
          params: cancellationParamsFromSettings(await settings.get()), // D62
        });
        if (!booking.paymentIntentId) {
          throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "This deal has no payment to refund.");
        }
        try {
          refundId = (await provider.refund(booking.paymentIntentId, refundAmountCents)).refundId;
        } catch {
          throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "The refund could not be issued.");
        }
        const retentionCents = booking.pricing.totalShipperCents - refundAmountCents;
        if (retentionCents > 0) {
          // A81 — après le départ sans prise en charge, personne ne sait qui a
          // fait défaut : la retenue est conservée « à arbitrer » (chantier C).
          const beforeDeparture = now.getTime() < booking.trip.departureAt.getTime();
          retention = beforeDeparture
            ? {
                retentionCents,
                retentionDisposition: "CARRIER",
                compensationCents: computeLateCancellationCompensationCents({
                  retentionCents,
                  transportCents: booking.pricing.transportCents,
                  totalShipperCents: booking.pricing.totalShipperCents,
                }),
              }
            : { retentionCents, retentionDisposition: "HELD_FOR_MEDIATION", compensationCents: 0 };
        }
      } else {
        // PENDING : l'empreinte n'a jamais été capturée — libération intégrale.
        refundAmountCents = booking.pricing.totalShipperCents;
        await releaseAuthorization(booking.paymentIntentId);
      }

      await applyBookingTransition({
        booking,
        from: booking.status as BookingStatus,
        data: {
          status: to,
          closedAt: now,
          closedBy: "SHIPPER",
          cancelReason: input.reason ?? null,
          refundedAt: now,
          refundAmountCents,
          ...(refundId ? { refundId } : {}),
          ...(retention
            ? {
                retentionCents: retention.retentionCents,
                retentionDisposition: retention.retentionDisposition,
                // A80 — la compensation part par l'exécuteur unique, juste après.
                ...(retention.compensationCents > 0
                  ? { payoutStatus: "PENDING", payoutAmountCents: retention.compensationCents, payoutFailureReason: null }
                  : {}),
              }
            : {}),
        },
        releaseKg: true,
        events: [
          {
            eventType: "booking.cancelled",
            payload: {
              ...baseEventPayload(booking, "SHIPPER"),
              cancelledBy: "SHIPPER",
              reason: input.reason ?? null,
              wasAccepted,
              closedAt: now.toISOString(),
            },
          },
          {
            eventType: "booking.refund_issued",
            payload: {
              ...baseEventPayload(booking, "SHIPPER"),
              amountCents: refundAmountCents,
              refundedAt: now.toISOString(),
            },
          },
        ],
        now,
      });

      // A80 — compensation IMMÉDIATE (l'annulation est déjà acquise : un échec
      // du transfert devient FAILED, rejoué par le cron — jamais une erreur ici).
      if (retention && retention.compensationCents > 0 && payoutExecutor) {
        try {
          await payoutExecutor.executePayout(
            { ...booking, status: "CANCELLED", payoutStatus: "PENDING", payoutAmountCents: retention.compensationCents, payoutAttempts: 0 },
            now
          );
        } catch {
          // L'état FAILED est écrit par l'exécuteur ; le cron reprend.
        }
      }

      // D29① — une annulation tardive est un fait de réputation (Expéditeur).
      if (retention) await recomputeBookingParties(booking);

      return transitionResponse(booking, to, refundAmountCents);
    },

    /* ── Cron expiration 24 h (DEA-01) ──────────────────────── */

    /**
     * Passe UNE fournée de PENDING périmés en EXPIRED (libération de
     * l'empreinte + kg + outbox). Chaque booking est traité isolément :
     * un échec n'empêche pas les autres. Retourne le nombre expiré.
     */
    async expireDueBookings(batchSize = 50): Promise<number> {
      const now = clock();
      const due = await prisma.booking.findMany({
        where: { status: "PENDING", isDeleted: false, expiresAt: { lt: now } },
        select: BOOKING_SELECT,
        take: batchSize,
        orderBy: { expiresAt: "asc" },
      });

      let expired = 0;
      for (const raw of due) {
        const booking: BookingForLifecycle = toBookingForWrite(raw as unknown as Record<string, unknown>);
        try {
          const { to } = assertTransition(booking, "expire", "SYSTEM", now);
          await releaseAuthorization(booking.paymentIntentId);
          const total = booking.pricing.totalShipperCents;
          await applyBookingTransition({
            booking,
            from: "PENDING",
            data: { status: to, closedAt: now, closedBy: "SYSTEM" },
            releaseKg: true,
            events: [
              {
                eventType: "booking.expired",
                payload: { ...baseEventPayload(booking, "SYSTEM"), closedAt: now.toISOString() },
              },
              {
                eventType: "booking.refund_issued",
                payload: {
                  ...baseEventPayload(booking, "SYSTEM"),
                  amountCents: total,
                  refundedAt: now.toISOString(),
                },
              },
            ],
            now,
          });
          expired += 1;
        } catch {
          // Course (accepté/annulé entre le findMany et la transaction) :
          // le booking n'est plus PENDING, on passe au suivant.
        }
      }
      return expired;
    },

    /* ── Webhook D40 : l'empreinte est morte chez Stripe ────── */

    /**
     * `payment_intent.canceled` : si un Booking PENDING porte cet intent,
     * il n'est plus acceptable (plus d'argent) → SYSTEM cancel. Aucun
     * remboursement (l'autorisation est déjà libérée). Idempotent :
     * booking absent ou déjà terminal ⇒ no-op.
     */
    async cancelBookingForDeadPayment(paymentIntentId: string): Promise<boolean> {
      const now = clock();
      const raw = await prisma.booking.findFirst({
        where: { paymentIntentId, isDeleted: false },
        select: BOOKING_SELECT,
      });
      if (!raw || String(raw.status) !== "PENDING") return false;
      const booking: BookingForLifecycle = toBookingForWrite(raw as unknown as Record<string, unknown>);

      try {
        const { to } = assertTransition(booking, "cancel", "SYSTEM", now);
        await applyBookingTransition({
          booking,
          from: "PENDING",
          data: { status: to, closedAt: now, closedBy: "SYSTEM", cancelReason: "PAYMENT_AUTHORIZATION_LOST" },
          releaseKg: true,
          events: [
            {
              eventType: "booking.cancelled",
              payload: {
                ...baseEventPayload(booking, "SYSTEM"),
                cancelledBy: "SYSTEM",
                reason: "PAYMENT_AUTHORIZATION_LOST",
                wasAccepted: false,
                closedAt: now.toISOString(),
              },
            },
          ],
          now,
        });
        return true;
      } catch {
        // Course : quelqu'un a fermé le booking entre-temps — idempotent.
        return false;
      }
    },
  };
}

export type DealLifecycleService = ReturnType<typeof makeDealLifecycleService>;
