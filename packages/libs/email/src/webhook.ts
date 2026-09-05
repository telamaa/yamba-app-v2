/**
 * webhook.ts — le retour du monde réel (D35 3A) : signature Svix et règle de suppression
 * =======================================================================================
 * Resend signe ses webhooks au format Svix : en-têtes `svix-id`, `svix-timestamp`, `svix-signature`
 * (« v1,<base64> » — plusieurs séparés par des espaces lors d'une rotation), secret `whsec_<base64>`,
 * contenu signé `${id}.${timestamp}.${corps brut}` en HMAC-SHA256. Tolérance 5 min. Pur : testé sur vecteurs.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export function svixSign(secret: string, id: string, timestamp: string, body: string): string {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return createHmac("sha256", Buffer.from(raw, "base64")).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvixSignature(input: { secret: string; id: string | undefined; timestamp: string | undefined; signature: string | undefined; body: string; now?: Date; toleranceSeconds?: number }): { ok: true } | { ok: false; reason: "MISSING_HEADERS" | "STALE" | "BAD_SIGNATURE" } {
  if (!input.id || !input.timestamp || !input.signature) return { ok: false, reason: "MISSING_HEADERS" };
  const ts = Number(input.timestamp);
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > (input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS)) return { ok: false, reason: "STALE" };
  const expected = Buffer.from(svixSign(input.secret, input.id, input.timestamp, input.body));
  const candidates = input.signature.split(" ").map((s) => s.trim()).filter(Boolean).map((s) => (s.includes(",") ? s.split(",")[1] : s));
  for (const c of candidates) {
    const got = Buffer.from(c);
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true };
  }
  return { ok: false, reason: "BAD_SIGNATURE" };
}

/* ── Événements Resend → statut de livraison et suppression (D35 4A) ─────── */
export type EmailEventType = "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.opened" | "email.clicked" | (string & {});
export type ResendWebhookEvent = { type: EmailEventType; created_at?: string; data?: { email_id?: string; to?: string[] | string; subject?: string; bounce?: { type?: string; subType?: string; message?: string } } };
export type DeliveryStatus = "DELIVERED" | "BOUNCED" | "COMPLAINED";
export type SuppressionReason = "HARD_BOUNCE" | "COMPLAINT";

/** Pur : quel statut poser sur la trace, et faut-il supprimer l'adresse ? `null` = événement sans effet (ouvert, cliqué, envoyé…). */
export function interpretEmailEvent(e: ResendWebhookEvent): { status: DeliveryStatus; suppress: SuppressionReason | null; recipient: string | null; messageId: string | null } | null {
  const messageId = e.data?.email_id ?? null;
  const to = e.data?.to;
  const recipient = (Array.isArray(to) ? to[0] : to) ?? null;
  switch (e.type) {
    case "email.delivered":
      return { status: "DELIVERED", suppress: null, recipient, messageId };
    case "email.bounced": {
      const hard = (e.data?.bounce?.type ?? "").toLowerCase() !== "transient" && (e.data?.bounce?.type ?? "").toLowerCase() !== "soft";
      return { status: "BOUNCED", suppress: hard ? "HARD_BOUNCE" : null, recipient, messageId };
    }
    case "email.complained":
      return { status: "COMPLAINED", suppress: "COMPLAINT", recipient, messageId };
    default:
      return null;
  }
}
