/**
 * deal-transport.service.ts — pickup / refusePickup / tracking / regenerate / deliver (B3-PR1)
 * =============================================================================================
 * Emplacement : apps/deal-service/src/services/deal-transport.service.ts
 *
 * Même rituel que deal-lifecycle.service.ts :
 *   1. Charger le booking (booking-write.ts), vérifier la partie (403).
 *   2. Demander à la booking-state-machine — transition (`canPerform`)
 *      ou opération gardée (`canConfirmTrackingStep`, `canRegenerateCode`).
 *      Refus ⇒ 409 avec SA raison. Jamais une décision ici.
 *   3. L'argent d'abord quand il bouge (refus au pickup = remboursement
 *      intégral, A40), la base ensuite.
 *   4. UNE transaction Mongo conditionnelle + outbox (applyBookingTransition).
 *
 * Le code de livraison (D43) : généré ICI au pickup, écrit sous ses deux
 * formes (bcrypt + AES) dans la même transaction, retourné en clair
 * UNIQUEMENT par `regenerateCode` (à l'Expéditeur) — jamais dans un
 * événement, jamais au Voyageur (INV-1).
 *
 * Tentatives (A38) : le serveur compte ; mauvais code → +1 par
 * updateMany conditionnel sur le compteur lu ; 3e échec → verrou 15 min
 * ET compteur remis à 0. Une tentative échouée n'est pas un changement
 * d'état métier : pas d'événement outbox.
 */

import prisma from "@packages/libs/prisma";
import { ForbiddenError } from "@packages/error-handler";
import type { PaymentProvider } from "@packages/payments";
import type {
  BookingActor,
  ConfirmPickupRequest,
  ConfirmTrackingStepRequest,
  DealTransitionResponse,
  DeliverDealRequest,
  DeliverDealResponse,
  RefusePickupRequest,
  RegenerateCodeResponse,
  TrackingStepResponse,
} from "@packages/api-contracts";
import {
  DELIVERY_LOCK_MINUTES,
  MAX_CODE_REGENERATIONS,
  MAX_DELIVERY_ATTEMPTS,
  PAYOUT_DELAY_DAYS,
  canConfirmTrackingStep,
  canPerform,
  canRegenerateCode,
  type BookingStatus,
  type BookingTransitionAction,
} from "./booking-state-machine";
import { BookingLifecycleError, baseEventPayload } from "./booking-lifecycle";
import { applyBookingTransition, loadBookingForWrite, type BookingForWrite } from "./booking-write";
import { issueDeliveryCode, verifyDeliveryCode } from "@packages/delivery-code";

export type RequestingUser = { id: string };

/** Sous-ensemble machine : statut + guards de livraison. */
function machineView(booking: BookingForWrite) {
  return {
    status: booking.status as BookingStatus,
    isDeleted: booking.isDeleted,
    expiresAt: booking.expiresAt,
    deliveryAttempts: booking.deliveryAttempts,
    deliveryLockedUntil: booking.deliveryLockedUntil,
    codeRegenerations: booking.codeRegenerations,
  };
}

export function makeDealTransportService(provider: PaymentProvider, clock: () => Date = () => new Date()) {
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

  function assertCarrier(booking: BookingForWrite, user: RequestingUser, verb: string): void {
    if (booking.carrierId !== user.id) {
      // 403 et non 404 : le deal existe, l'appelant n'est pas le Voyageur.
      throw new ForbiddenError(`Only the carrier can ${verb} this deal.`);
    }
  }

  return {
    /* ── POST /deals/:id/pickup ──────────────────────────────── */
    async confirmPickup(user: RequestingUser, dealId: string, input: ConfirmPickupRequest): Promise<DealTransitionResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertCarrier(booking, user, "confirm the pickup of");
      const { to } = assertTransition(booking, "pickup", "CARRIER", now);

      // D43 — le code naît ici, sous ses deux formes, écrites en transaction.
      const code = await issueDeliveryCode();

      await applyBookingTransition({
        booking,
        from: "ACCEPTED",
        data: {
          status: to,
          pickedUpAt: now,
          pickup: {
            confirmedAt: now,
            photoUrls: input.photoUrls,
            notes: input.notes ?? null,
            checklist: [...input.checklist],
          },
          deliveryCodeHash: code.deliveryCodeHash,
          deliveryCodeEncrypted: code.deliveryCodeEncrypted,
          codeRegenerations: 0,
          deliveryAttempts: 0,
          deliveryLockedUntil: null,
        },
        releaseKg: false,
        events: [
          {
            eventType: "booking.picked_up",
            payload: {
              ...baseEventPayload(booking, "CARRIER"),
              pickedUpAt: now.toISOString(),
              photoCount: input.photoUrls.length,
            },
          },
        ],
        now,
      });

      return { bookingId: booking.id, status: to, refundAmountCents: null, currencyCode: booking.pricing.currencyCode };
    },

    /* ── POST /deals/:id/pickup/refuse (A40) ─────────────────── */
    async refusePickup(user: RequestingUser, dealId: string, input: RefusePickupRequest): Promise<DealTransitionResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertCarrier(booking, user, "refuse the pickup of");
      const { to } = assertTransition(booking, "refusePickup", "CARRIER", now);

      // L'argent est CAPTURÉ (D39) : vrai remboursement, intégral, AVANT la base.
      const total = booking.pricing.totalShipperCents;
      if (!booking.paymentIntentId) {
        throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "This deal has no payment to refund.");
      }
      try {
        await provider.refund(booking.paymentIntentId, total);
      } catch {
        throw new BookingLifecycleError("PAYMENT_STATE_CONFLICT", "The refund could not be issued.");
      }

      await applyBookingTransition({
        booking,
        from: "ACCEPTED",
        data: {
          status: to,
          closedAt: now,
          closedBy: "CARRIER",
          pickupRefusalReason: input.reason ?? null,
          refundedAt: now,
          refundAmountCents: total,
        },
        releaseKg: true,
        events: [
          {
            eventType: "booking.pickup_refused",
            payload: { ...baseEventPayload(booking, "CARRIER"), reason: input.reason ?? null, closedAt: now.toISOString() },
          },
          {
            eventType: "booking.refund_issued",
            payload: { ...baseEventPayload(booking, "CARRIER"), amountCents: total, refundedAt: now.toISOString() },
          },
        ],
        now,
      });

      return { bookingId: booking.id, status: to, refundAmountCents: total, currencyCode: booking.pricing.currencyCode };
    },

    /* ── POST /deals/:id/events (A39) ────────────────────────── */
    async confirmTrackingStep(
      user: RequestingUser,
      dealId: string,
      input: ConfirmTrackingStepRequest
    ): Promise<TrackingStepResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertCarrier(booking, user, "track");

      const confirmed = booking.trackingEvents.map((e) => e.step);
      const check = canConfirmTrackingStep(machineView(booking), confirmed, input.step);
      if (!check.allowed) {
        throw new BookingLifecycleError("TRACKING_STEP_NOT_ALLOWED", check.reason);
      }

      // Pas de transition : le statut reste PICKED_UP. La garde `none`
      // sur le jalon rend l'écriture idempotente face à un double envoi.
      await applyBookingTransition({
        booking,
        from: "PICKED_UP",
        where: { trackingEvents: { none: { step: input.step } } },
        data: { trackingEvents: { push: { step: input.step, confirmedAt: now } } },
        releaseKg: false,
        events: [
          {
            eventType: "booking.tracking_event",
            payload: { ...baseEventPayload(booking, "CARRIER"), step: input.step, confirmedAt: now.toISOString() },
          },
        ],
        now,
        conflictMessage: "This tracking step was already confirmed.",
      });

      return {
        bookingId: booking.id,
        step: input.step,
        confirmedAt: now.toISOString(),
        trackingEvents: [
          ...booking.trackingEvents.map((e) => ({ step: e.step as TrackingStepResponse["step"], confirmedAt: e.confirmedAt.toISOString() })),
          { step: input.step, confirmedAt: now.toISOString() },
        ],
      };
    },

    /* ── POST /deals/:id/code/regenerate (Expéditeur) ────────── */
    async regenerateCode(user: RequestingUser, dealId: string): Promise<RegenerateCodeResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      if (booking.shipperId !== user.id) {
        throw new ForbiddenError("Only the shipper can regenerate the delivery code.");
      }
      const check = canRegenerateCode(machineView(booking));
      if (!check.allowed) {
        throw new BookingLifecycleError("CODE_REGENERATION_LIMIT", check.reason);
      }

      const code = await issueDeliveryCode();
      const regenerationsUsed = booking.codeRegenerations + 1;
      const regenerationsLeft = MAX_CODE_REGENERATIONS - regenerationsUsed;

      await applyBookingTransition({
        booking,
        from: "PICKED_UP",
        // Garde optimiste sur le compteur lu : deux clics = une seule régénération.
        where: { codeRegenerations: booking.codeRegenerations },
        data: {
          deliveryCodeHash: code.deliveryCodeHash,
          deliveryCodeEncrypted: code.deliveryCodeEncrypted,
          codeRegenerations: regenerationsUsed,
          // Un nouveau code = une fenêtre d'essais neuve pour le destinataire.
          deliveryAttempts: 0,
          deliveryLockedUntil: null,
        },
        releaseKg: false,
        events: [
          {
            eventType: "booking.code_regenerated",
            payload: { ...baseEventPayload(booking, "SHIPPER"), regenerationsUsed, regenerationsLeft },
          },
        ],
        now,
      });

      return { bookingId: booking.id, deliveryCode: code.code, codeRegenerationsLeft: regenerationsLeft };
    },

    /* ── POST /deals/:id/deliver (A38) ───────────────────────── */
    async deliver(user: RequestingUser, dealId: string, input: DeliverDealRequest): Promise<DeliverDealResponse> {
      const now = clock();
      const booking = await loadBookingForWrite(dealId);
      assertCarrier(booking, user, "deliver");
      // Le guard machine : lock 15 min puis plafond — avant même de comparer.
      const { to } = assertTransition(booking, "deliver", "CARRIER", now);

      if (!booking.deliveryCodeHash) {
        // Enregistrement PICKED_UP antérieur à B3 (seed B1) : aucun code n'a été généré.
        throw new BookingLifecycleError("DELIVERY_CODE_UNAVAILABLE", "No delivery code was generated for this deal.");
      }

      const valid = await verifyDeliveryCode(input.code, booking.deliveryCodeHash);
      if (!valid) {
        const attemptsUsed = booking.deliveryAttempts + 1;
        const locked = attemptsUsed >= MAX_DELIVERY_ATTEMPTS;
        const lockedUntil = locked ? new Date(now.getTime() + DELIVERY_LOCK_MINUTES * 60_000) : null;
        // Écriture CONDITIONNELLE sur le compteur lu : deux saisies
        // concurrentes n'en comptent qu'une (l'autre relit et réessaie).
        const written = await prisma.booking.updateMany({
          where: { id: booking.id, status: "PICKED_UP", deliveryAttempts: booking.deliveryAttempts },
          data: locked
            ? { deliveryAttempts: 0, deliveryLockedUntil: lockedUntil }
            : { deliveryAttempts: attemptsUsed },
        });
        if (written.count === 0) {
          throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "This deal changed in the meantime — please refresh.");
        }
        if (locked) {
          throw new BookingLifecycleError(
            "DELIVERY_LOCKED",
            `Too many failed attempts. Delivery is locked for ${DELIVERY_LOCK_MINUTES} minutes.`,
            { lockedUntil: lockedUntil!.toISOString(), attemptsLeft: 0 }
          );
        }
        throw new BookingLifecycleError("DELIVERY_CODE_INVALID", "This code is not the right one.", {
          attemptsLeft: MAX_DELIVERY_ATTEMPTS - attemptsUsed,
        });
      }

      const attemptsUsed = booking.deliveryAttempts + 1;
      const payoutDueAt = new Date(now.getTime() + PAYOUT_DELAY_DAYS * 24 * 3_600_000);

      await applyBookingTransition({
        booking,
        from: "PICKED_UP",
        where: { deliveryAttempts: booking.deliveryAttempts },
        // A76 — photos OPTIONNELLES de la remise (l'assurance du Voyageur), figées avec la transition.
        data: { status: to, deliveredAt: now, payoutDueAt, deliveryAttempts: attemptsUsed, deliveryPhotoUrls: input.photoUrls ?? [] },
        releaseKg: false,
        events: [
          {
            eventType: "booking.delivered",
            payload: {
              ...baseEventPayload(booking, "CARRIER"),
              deliveredAt: now.toISOString(),
              payoutDueAt: payoutDueAt.toISOString(),
              attemptsUsed,
            },
          },
        ],
        now,
      });

      return { bookingId: booking.id, status: to, deliveredAt: now.toISOString(), payoutDueAt: payoutDueAt.toISOString() };
    },
  };
}

export type DealTransportService = ReturnType<typeof makeDealTransportService>;
