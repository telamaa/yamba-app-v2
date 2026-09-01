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
import { constructStripeWebhookEvent } from "@packages/payments";
import type { DealLifecycleService } from "../services/deal-lifecycle.service";

export function makeStripeWebhookHandler(service: DealLifecycleService, logger: Logger) {
  return async (req: Request, res: Response): Promise<void> => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
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

    let event;
    try {
      event = constructStripeWebhookEvent(req.body as Buffer, signature, secret);
    } catch {
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
      }
      res.json({ received: true });
    } catch (err) {
      // Échec transitoire (base indisponible…) : 500 → Stripe réessaie.
      logger.error({ err, eventId: event.id, eventType: event.type }, "Stripe webhook processing failed");
      res.status(500).json({ error: "Webhook processing failed." });
    }
  };
}
