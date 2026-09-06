/**
 * stripe-webhook.controller.ts — POST /webhooks/stripe (D40)
 * ==========================================================
 * Le webhook est la SOURCE DE VÉRITÉ de l'état du paiement : entre notre
 * base et Stripe, c'est Stripe qui a l'argent — notre état converge vers
 * le sien, jamais l'inverse.
 *
 * Contraintes de câblage (main.ts) :
 *   - corps BRUT obligatoire (express.raw) : la signature porte sur les
 *     octets exacts — la route est montée AVANT express.json.
 *   - en dev : `stripe listen --forward-to localhost:6003/webhooks/stripe`
 *     (DIRECT, jamais via le gateway qui re-sérialise le JSON).
 *
 * Événements :
 *   - payment_intent.canceled          → l'empreinte est morte (expiration
 *     ~7 j, annulation fournisseur) : un Booking PENDING qui la porte est
 *     annulé par SYSTEM (machine, D40). Idempotent.
 *   - payment_intent.amount_capturable_updated → accusé simple :
 *     l'autorisation est posée ; la création du deal reste pilotée par
 *     POST /deals (D37).
 *
 * Réponses : 2xx = traité (Stripe ne renverra pas) ; 4xx = signature ou
 * requête invalide (pas de retry utile) ; 5xx = échec transitoire (base
 * indisponible) → Stripe RÉESSAIE, c'est le filet voulu.
 */

import type { Request, Response } from "express";
import type { Logger } from "pino";
import prisma from "@packages/libs/prisma";
import { constructStripeWebhookEvent, type PaymentWebhookEvent } from "@packages/payments";
import type { DealLifecycleService } from "../services/deal-lifecycle.service";
import type { DealSettlementService } from "../services/deal-settlement.service";
import { notifyCarrierPayoutFailed } from "../services/ops-notify.service";

/**
 * A87 — un seul URL, DEUX endpoints Stripe : les événements de la plateforme
 * (STRIPE_WEBHOOK_SECRET) et ceux des comptes connectés (Connect,
 * STRIPE_CONNECT_WEBHOOK_SECRET). Chaque endpoint signe avec SON secret :
 * on essaie l'un puis l'autre.
 */
function verifyWithAnySecret(rawBody: Buffer, signature: string, secrets: string[]): PaymentWebhookEvent | null {
  for (const secret of secrets) {
    try {
      return constructStripeWebhookEvent(rawBody, signature, secret);
    } catch {
      // secret suivant
    }
  }
  return null;
}

export function makeStripeWebhookHandler(service: DealLifecycleService, logger: Logger, settlement?: DealSettlementService) {
  return async (req: Request, res: Response): Promise<void> => {
    const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
      .map((s) => s?.trim())
      .filter((s): s is string => !!s);
    const secret = secrets[0];
    if (!secret) {
      // Provider FAKE ou secret non posé : l'endpoint existe mais ne peut
      // rien vérifier — on refuse plutôt que d'accepter sans signature.
      res.status(501).json({ error: "Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET missing)." });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !signature) {
      res.status(400).json({ error: "Missing stripe-signature header." });
      return;
    }

    const event = verifyWithAnySecret(req.body as Buffer, signature, secrets);
    if (!event) {
      res.status(400).json({ error: "Invalid webhook signature." });
      return;
    }

    try {
      if (event.type === "payment_intent.canceled" && event.paymentIntentId) {
        const cancelled = await service.cancelBookingForDeadPayment(event.paymentIntentId);
        logger.info(
          { eventId: event.id, paymentIntentId: event.paymentIntentId, cancelled },
          "Stripe webhook: payment_intent.canceled processed"
        );
      } else if (event.type === "payment_intent.amount_capturable_updated") {
        logger.info(
          { eventId: event.id, paymentIntentId: event.paymentIntentId },
          "Stripe webhook: authorization confirmed"
        );
      } else if (event.type === "account.updated" && event.accountFlags && event.objectId) {
        // A87 — les drapeaux du Voyageur suivent Stripe sans qu'il repasse par l'onboarding ;
        // compte prêt → ses versements bloqués repartent tout de suite (hors plafond A65).
        const flags = event.accountFlags;
        const page = await prisma.carrierPage.findFirst({ where: { stripeAccountId: event.objectId }, select: { userId: true, stripePayoutsEnabled: true } });
        if (page) {
          await prisma.carrierPage.update({
            where: { userId: page.userId },
            data: { stripeChargesEnabled: flags.chargesEnabled, stripePayoutsEnabled: flags.payoutsEnabled, stripeOnboardingComplete: flags.detailsSubmitted },
          });
          let retried = 0;
          if (flags.payoutsEnabled && settlement) retried = await settlement.retryPayoutsForCarrier(page.userId);
          logger.info({ eventId: event.id, account: event.objectId, ...flags, retried }, "Stripe webhook: account.updated processed");
        } else {
          logger.warn({ eventId: event.id, account: event.objectId }, "Stripe webhook: account.updated for an unknown carrier");
        }
      } else if (event.type === "transfer.reversed" && event.objectId && settlement) {
        const marked = await settlement.markTransferReversed(event.objectId);
        logger.warn({ eventId: event.id, transferId: event.objectId, marked }, "Stripe webhook: transfer.reversed processed");
      } else if (event.type === "payout.failed" && event.account) {
        // Compte connecté : la banque du Voyageur a refusé le virement — on le prévient (RIB).
        const notified = await notifyCarrierPayoutFailed(event.account, event.id);
        logger.warn({ eventId: event.id, account: event.account, notified }, "Stripe webhook: payout.failed processed");
      }
      res.json({ received: true });
    } catch (err) {
      // Échec transitoire (base indisponible…) : 500 → Stripe réessaie.
      logger.error({ err, eventId: event.id, eventType: event.type }, "Stripe webhook processing failed");
      res.status(500).json({ error: "Webhook processing failed." });
    }
  };
}
