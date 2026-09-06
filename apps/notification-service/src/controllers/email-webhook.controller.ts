/**
 * email-webhook.controller.ts — le retour du monde réel (D35 3A/4A)
 * =================================================================
 * `POST /webhooks/email/resend` : signature Svix vérifiée sur le CORPS BRUT (req.rawBody posé par
 * express.json({ verify })), événement interprété par une règle pure, trace `EmailDelivery` mise à
 * jour par `providerMessageId` (idempotent : un événement inconnu ou déjà appliqué répond 200 sans
 * effet), et, sur rebond dur ou plainte, l'adresse du compte est mise sur la liste de suppression
 * (écriture sur `User` assumée : c'est un fait de délivrabilité que seul ce service apprend).
 */
import type { Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { interpretEmailEvent, verifySvixSignature, type ResendWebhookEvent } from "@packages/email";

export type RawBodyRequest = Request & { rawBody?: string };

export function makeEmailWebhookController(deps: { secret: () => string | undefined; log: { warn(o: unknown, m: string): void; info(o: unknown, m: string): void } }) {
  return async (req: RawBodyRequest, res: Response) => {
    const secret = deps.secret();
    if (!secret) return res.status(503).json({ message: "Webhook not configured (RESEND_WEBHOOK_SECRET)." });
    const body = req.rawBody ?? JSON.stringify(req.body ?? {});
    const check = verifySvixSignature({ secret, id: req.header("svix-id"), timestamp: req.header("svix-timestamp"), signature: req.header("svix-signature"), body });
    if (!check.ok) {
      deps.log.warn({ reason: check.reason }, "Email webhook rejected");
      return res.status(401).json({ message: "Invalid signature.", reason: check.reason });
    }
    const event = req.body as ResendWebhookEvent;
    const outcome = interpretEmailEvent(event);
    if (!outcome) return res.status(200).json({ ok: true, ignored: event.type });
    const now = new Date();
    if (outcome.messageId) {
      const data = outcome.status === "DELIVERED" ? { status: "DELIVERED" as const, deliveredAt: now } : { status: outcome.status, bouncedAt: now, bounceType: event.data?.bounce?.type ?? (outcome.status === "COMPLAINED" ? "complaint" : null) };
      await prisma.emailDelivery.updateMany({ where: { providerMessageId: outcome.messageId }, data });
    }
    let suppressed = false;
    if (outcome.suppress && outcome.recipient) {
      const r = await prisma.user.updateMany({
        where: { emailNormalized: outcome.recipient.trim().toLowerCase(), OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] } as never,
        data: { emailSuppressedAt: now, emailSuppressedReason: outcome.suppress },
      });
      suppressed = r.count > 0;
      if (suppressed) deps.log.warn({ reason: outcome.suppress, messageId: outcome.messageId }, "Email address suppressed (D35 4A)");
    }
    return res.status(200).json({ ok: true, status: outcome.status, suppressed });
  };
}
