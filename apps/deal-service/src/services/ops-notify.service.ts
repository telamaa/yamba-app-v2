/**
 * ops-notify.service.ts — notifications HORS événement de booking (A87/A88)
 * ========================================================================
 * Deux exceptions assumées au patron « outbox → notification-service » :
 * l'événement porte sur un COMPTE (webhook Connect `payout.failed`) ou sur
 * l'exploitation (récapitulatif support), pas sur un deal. Le deal-service
 * écrit alors lui-même la notification in-app (table partagée, id
 * d'événement synthétique) et envoie l'email par le gabarit partagé (D44).
 */

import { randomBytes } from "node:crypto";
import prisma from "@packages/libs/prisma";
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import { resolveLocale } from "@packages/api-contracts";
import { OPS_EMAILS, type OpsDigestLine } from "../emails/ops-emails";
import type { BookingForWrite } from "./booking-write";

const APP_URL = process.env.USER_APP_URL ?? "http://localhost:3000";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@yamba.app";
// C-PR5 (D58 7A) — le digest pointe vers les files admin, pas vers l'app Voyageur
const ADMIN_URL = (process.env.ADMIN_UI_URL ?? "http://localhost:3001").replace(/\/$/, "");

const syntheticEventId = () => randomBytes(12).toString("hex");

function money(cents: number, currency: string, locale: "fr" | "en"): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency }).format(cents / 100);
}

/** `payout.failed` sur le compte connecté : prévenir le Voyageur (in-app + email), jamais le message brut de la banque. */
export async function notifyCarrierPayoutFailed(stripeAccountId: string, stripeEventId: string): Promise<boolean> {
  const page = await prisma.carrierPage.findFirst({ where: { stripeAccountId }, select: { userId: true } });
  if (!page) return false;
  const user = await prisma.user.findUnique({ where: { id: page.userId }, select: { id: true, email: true, firstName: true, preferredLocale: true, isDeleted: true, emailSuppressedAt: true } });
  if (!user) return false;
  const locale = resolveLocale(user.preferredLocale);

  await prisma.notification.upsert({
    where: { eventId_userId: { eventId: syntheticEventId(), userId: user.id } },
    create: {
      userId: user.id,
      eventId: syntheticEventId(),
      type: "carrier.payout_failed",
      bookingId: null,
      payload: { stripeEventId },
      readAt: null,
    },
    update: {},
  });

  if (user.email && !user.isDeleted && !user.emailSuppressedAt && isEmailConfigured()) { // D35 4A / D63 4A
    const built = OPS_EMAILS[locale].payoutFailedCarrier({ firstName: user.firstName, financesUrl: `${APP_URL}/${locale}/dashboard/finances` });
    await sendTransactionalEmail({ to: user.email, locale, subject: built.subject, content: built.content });
  }
  return true;
}

/** Récapitulatif quotidien au support (A88). Retourne false si rien à dire ou SMTP absent. */
export async function sendOpsDigest(
  digest: { failed: BookingForWrite[]; reversed: BookingForWrite[]; held: BookingForWrite[] },
  now: Date
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  if (digest.failed.length + digest.reversed.length + digest.held.length === 0) return false;
  const locale = "fr" as const;
  const line = (b: BookingForWrite, amountCents: number, sinceDate: Date | null | undefined): OpsDigestLine => ({
    label: `${b.trip.originCity} → ${b.trip.destinationCity} · ${b.status} · ${b.id}`,
    amount: money(amountCents, b.pricing.currencyCode, locale),
    since: (sinceDate ?? now).toLocaleDateString("fr-FR"),
    url: `${ADMIN_URL}/deals/${b.id}`,
  });
  const built = OPS_EMAILS[locale].opsDigest({
    date: now.toLocaleDateString("fr-FR"),
    failed: digest.failed.map((b) => line(b, b.payoutAmountCents ?? b.pricing.transportCents, b.updatedAt)),
    reversed: digest.reversed.map((b) => line(b, b.payoutAmountCents ?? b.pricing.transportCents, b.updatedAt)),
    held: digest.held.map((b) => line(b, b.retentionCents ?? 0, b.updatedAt)),
    appUrl: `${ADMIN_URL}/finances`,
  });
  await sendTransactionalEmail({ to: SUPPORT_EMAIL, locale, subject: built.subject, content: built.content });
  return true;
}
