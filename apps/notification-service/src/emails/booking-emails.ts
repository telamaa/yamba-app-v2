/**
 * booking-emails.ts — la colonne EMAIL de la matrice A15 (D41/A35/A36)
 * ====================================================================
 * Deuxième canal du MÊME consumer que l'in-app : appelé par
 * handleBookingEventMessage APRÈS la matérialisation des rows
 * Notification, AVANT le PROCESSED du ConsumedEvent.
 *
 * Trois règles gravées :
 * - A35 : la matrice est EN DATA et TOTALE (tsc casse si une clé
 *   manque) ; les clés B3/B4/B5 valent null — leur gabarit
 *   s'implémente dans la MÊME PR que le premier writer (miroir D30).
 * - A36 : at-most-once PAR DESTINATAIRE — claim `EmailDelivery`
 *   [eventId, userId] AVANT l'envoi ; échec = FAILED tracé, JAMAIS
 *   de throw (best-effort : ne bloque ni la partition ni l'in-app).
 * - D41 : jointure User à l'envoi (les événements ne portent ni
 *   email ni prénom) ; user effacé (RGPD) = envoi sauté, tracé ;
 *   locale FR par défaut (pas de preferredLocale sur User).
 *
 * Le code de livraison ne voyage JAMAIS ici : aucun payload ne le
 * contient (vérifié), aucun gabarit ne doit le demander.
 */
import { z } from "zod";
import path from "path";
import type { Logger } from "pino";
import { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import { isEmailConfigured, sendTemplatedEmail } from "@packages/email";

type BookingDomainEvent = z.infer<typeof BookingDomainEventSchema>;
type BookingEventKey = BookingDomainEvent["eventType"];

const APP_URL = process.env.USER_APP_URL ?? "http://localhost:3000";
const DEFAULT_LOCALE: "fr" | "en" = "fr"; // Plus tard : depuis user.preferredLocale
const TEMPLATES_DIR = path.join(
  process.cwd(),
  "apps/notification-service/src/emails/templates"
);

/* ══ A35 — la matrice email, en data ══════════════════════════ */

/** Destinataire(s) email d'un événement. `null` = pas d'email pour
 *  cette clé AUJOURD'HUI (soit jamais — anti-spam / in-app seul —
 *  soit « à venir » avec le writer B3/B4/B5 de l'événement). */
type EmailRule =
  | "SHIPPER"
  | "CARRIER"
  | "SHIPPER_PLUS_CARRIER_IF_WAS_ACCEPTED"
  | null;

export const EMAIL_MATRIX: Record<BookingEventKey, EmailRule> = {
  "booking.requested": "CARRIER",
  "booking.payment_authorized": "SHIPPER",
  "booking.accepted": "SHIPPER",
  "booking.declined": "SHIPPER",
  "booking.expired": "SHIPPER",
  "booking.cancelled": "SHIPPER_PLUS_CARRIER_IF_WAS_ACCEPTED",
  "booking.refund_issued": "SHIPPER",
  "booking.picked_up": "SHIPPER", // B3/A41 : « ton code est prêt dans ton suivi » (sans le code)
  "booking.pickup_refused": "SHIPPER", // B3/A41 : raison + remboursement annoncé (refund_issued suit)
  "booking.tracking_event": null, // JAMAIS : push seul (anti-spam)
  "booking.code_regenerated": "SHIPPER", // B3/A41 : email de sécurité (sans le code)
  "booking.delivered": "SHIPPER", // B3/A41 : « 3 jours pour confirmer ou signaler » (le Voyageur : in-app seul)
  "booking.completed": null, // à venir (writer B4)
  "booking.payout_sent": null, // à venir (writer B4)
  "booking.disputed": null, // à venir (writer B4)
  "booking.rating_reminder": null, // à venir (writer B5)
  "booking.rating_revealed": null, // JAMAIS : in-app seul
};

export type EmailRecipient = { userId: string; role: "SHIPPER" | "CARRIER" };

export function resolveEmailRecipients(
  event: BookingDomainEvent
): EmailRecipient[] {
  const shipper: EmailRecipient = {
    userId: event.payload.shipperId,
    role: "SHIPPER",
  };
  const carrier: EmailRecipient = {
    userId: event.payload.carrierId,
    role: "CARRIER",
  };
  switch (EMAIL_MATRIX[event.eventType]) {
    case "SHIPPER":
      return [shipper];
    case "CARRIER":
      return [carrier];
    case "SHIPPER_PLUS_CARRIER_IF_WAS_ACCEPTED":
      // Seul booking.cancelled porte cette règle (wasAccepted).
      return event.eventType === "booking.cancelled" &&
        event.payload.wasAccepted
        ? [shipper, carrier]
        : [shipper];
    case null:
      return [];
  }
}

/* ══ Helpers de formatage (cents A2 → affichage) ══════════════ */

function formatMoney(
  cents: number,
  currency: string,
  locale: "fr" | "en"
): string {
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDateTime(iso: string, locale: "fr" | "en"): string {
  return new Date(iso).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Libellés FR/EN des 5 raisons de refus du contrat (A32). */
const DECLINE_REASON_LABELS: Record<string, { fr: string; en: string }> = {
  CATEGORY_NOT_CARRIED: {
    fr: "Le Voyageur ne transporte pas ce type de colis",
    en: "The carrier does not transport this kind of parcel",
  },
  TOO_HEAVY: {
    fr: "Le colis est trop lourd pour la capacité restante",
    en: "The parcel is too heavy for the remaining capacity",
  },
  PLACES_INCOMPATIBLE: {
    fr: "Les lieux de remise ne sont pas compatibles",
    en: "The handoff places are not compatible",
  },
  TIMING: {
    fr: "Le calendrier ne convient pas",
    en: "The timing does not work",
  },
  OTHER: { fr: "Autre raison", en: "Other reason" },
};

/** Libellés FR/EN des 5 raisons de refus au pickup (A40). */
const PICKUP_REFUSAL_REASON_LABELS: Record<string, { fr: string; en: string }> = {
  CONTENT_MISMATCH: {
    fr: "Le contenu ne correspond pas à la déclaration",
    en: "The content does not match the declaration",
  },
  SUSPICIOUS_CONTENT: {
    fr: "Le contenu a paru suspect au Voyageur",
    en: "The carrier found the content suspicious",
  },
  OVERWEIGHT: {
    fr: "Le colis dépasse le poids déclaré",
    en: "The parcel exceeds the declared weight",
  },
  BAD_PACKAGING: {
    fr: "L'emballage n'est pas adapté au voyage",
    en: "The packaging is not fit for travel",
  },
  OTHER: { fr: "Autre raison", en: "Other reason" },
};

function formatDate(iso: string, locale: "fr" | "en"): string {
  return new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ══ Construction sujet + gabarit + données par événement ═════ */

type BuiltEmail = {
  subject: string;
  /** Relatif à templates/, sans .ejs — aussi tracé dans EmailDelivery. */
  template: string;
  data: Record<string, unknown>;
};

export function buildBookingEmail(
  event: BookingDomainEvent,
  role: "SHIPPER" | "CARRIER",
  recipientFirstName: string
): BuiltEmail | null {
  const locale = DEFAULT_LOCALE;
  const fr = locale === "fr";
  const p = event.payload;
  const route = `${p.corridor.originCity} → ${p.corridor.destinationCity}`;
  // A13 : le Voyageur ne voit QUE son net (transportCents) ; le total
  // Expéditeur ne sort jamais dans un email carrier.
  const ctaUrl =
    role === "SHIPPER"
      ? `${APP_URL}/${locale}/bookings/${p.bookingId}`
      : `${APP_URL}/${locale}/carrier/deals/${p.bookingId}`;
  const base = {
    locale,
    firstName: recipientFirstName,
    route,
    weightKg: p.weightKg,
    ctaUrl,
  };

  switch (event.eventType) {
    case "booking.requested":
      return {
        subject: fr
          ? `Nouvelle demande de transport ${route}`
          : `New transport request ${route}`,
        template: "booking/booking-requested-carrier",
        data: {
          ...base,
          earnings: formatMoney(p.transportCents, p.currencyCode, locale),
          expiresAt: formatDateTime(event.payload.expiresAt, locale),
        },
      };
    case "booking.payment_authorized":
      return {
        subject: fr
          ? `Reçu : paiement autorisé pour ton envoi ${route}`
          : `Receipt: payment authorized for your shipment ${route}`,
        template: "booking/payment-authorized-shipper",
        data: {
          ...base,
          amount: formatMoney(
            event.payload.amountCents,
            p.currencyCode,
            locale
          ),
        },
      };
    case "booking.accepted":
      return {
        subject: fr
          ? `Ta demande ${route} est acceptée`
          : `Your request ${route} was accepted`,
        template: "booking/booking-accepted-shipper",
        data: {
          ...base,
          total: formatMoney(p.totalShipperCents, p.currencyCode, locale),
          acceptedAt: formatDateTime(event.payload.acceptedAt, locale),
        },
      };
    case "booking.declined": {
      const reason = event.payload.reason
        ? DECLINE_REASON_LABELS[event.payload.reason]?.[locale] ?? null
        : null;
      return {
        subject: fr
          ? `Ta demande ${route} n'a pas pu être acceptée`
          : `Your request ${route} could not be accepted`,
        template: "booking/booking-declined-shipper",
        data: { ...base, reason },
      };
    }
    case "booking.expired":
      return {
        subject: fr
          ? `Ta demande ${route} a expiré`
          : `Your request ${route} has expired`,
        template: "booking/booking-expired-shipper",
        data: base,
      };
    case "booking.cancelled":
      if (role === "CARRIER") {
        return {
          subject: fr
            ? `Le deal ${route} a été annulé`
            : `The deal ${route} was cancelled`,
          template: "booking/booking-cancelled-carrier",
          data: { ...base, cancelledBy: event.payload.cancelledBy },
        };
      }
      return {
        subject: fr
          ? `Ta demande ${route} est annulée`
          : `Your request ${route} is cancelled`,
        template: "booking/booking-cancelled-shipper",
        data: { ...base, cancelledBy: event.payload.cancelledBy },
      };
    case "booking.refund_issued":
      return {
        subject: fr
          ? `Remboursement émis pour ton envoi ${route}`
          : `Refund issued for your shipment ${route}`,
        template: "booking/refund-issued-shipper",
        data: {
          ...base,
          amount: formatMoney(
            event.payload.amountCents,
            p.currencyCode,
            locale
          ),
        },
      };
    /* ── B3 (A41) — le code de livraison n'apparaît dans AUCUN de ces
          quatre gabarits : on annonce qu'il existe, jamais sa valeur. ── */
    case "booking.picked_up":
      return {
        subject: fr
          ? `Ton colis ${route} est pris en charge`
          : `Your parcel ${route} has been picked up`,
        template: "booking/booking-picked-up-shipper",
        data: {
          ...base,
          pickedUpAt: formatDateTime(event.payload.pickedUpAt, locale),
          photoCount: event.payload.photoCount,
        },
      };
    case "booking.pickup_refused": {
      const reason = event.payload.reason
        ? PICKUP_REFUSAL_REASON_LABELS[event.payload.reason]?.[locale] ?? null
        : null;
      return {
        subject: fr
          ? `Ton colis ${route} n'a pas pu être pris en charge`
          : `Your parcel ${route} could not be picked up`,
        template: "booking/pickup-refused-shipper",
        data: {
          ...base,
          reason,
          total: formatMoney(p.totalShipperCents, p.currencyCode, locale),
        },
      };
    }
    case "booking.code_regenerated":
      return {
        subject: fr
          ? `Nouveau code pour ton envoi ${route}`
          : `New code for your shipment ${route}`,
        template: "booking/code-regenerated-shipper",
        data: {
          ...base,
          regenerationsLeft: event.payload.regenerationsLeft,
        },
      };
    case "booking.delivered":
      return {
        subject: fr
          ? `Ton colis ${route} a été livré`
          : `Your parcel ${route} has been delivered`,
        template: "booking/booking-delivered-shipper",
        data: {
          ...base,
          deliveredAt: formatDateTime(event.payload.deliveredAt, locale),
          payoutDueAt: formatDate(event.payload.payoutDueAt, locale),
          transport: formatMoney(p.transportCents, p.currencyCode, locale),
        },
      };
    default:
      // Clé sans gabarit : la matrice (A35) empêche d'arriver ici —
      // filet si une règle est ajoutée sans son builder.
      return null;
  }
}

/* ══ Le dispatcher (A36 — claim-first, best-effort) ═══════════ */

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function dispatchBookingEmails(
  eventId: string,
  event: BookingDomainEvent,
  logger: Logger
): Promise<void> {
  const recipients = resolveEmailRecipients(event);
  if (recipients.length === 0) return;

  if (!isEmailConfigured()) {
    // Pas de claim : un env configuré plus tard ne verra de toute
    // façon pas ce message (offset commité) — inutile de le marquer.
    logger.info(
      { eventId, eventType: event.eventType },
      "SMTP not configured — booking emails skipped"
    );
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: recipients.map((r) => r.userId) } },
    select: { id: true, email: true, firstName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const recipient of recipients) {
    const user = byId.get(recipient.userId);
    if (!user?.email) {
      // RGPD (GHOST_COUNTERPART) ou donnée absente : sauté, tracé.
      logger.warn(
        { eventId, userId: recipient.userId, eventType: event.eventType },
        "Email recipient without user/email — skipped"
      );
      continue;
    }

    const built = buildBookingEmail(event, recipient.role, user.firstName);
    if (!built) continue;

    // A36 — claim AVANT l'envoi : P2002 = déjà claimé, jamais de renvoi.
    try {
      await prisma.emailDelivery.create({
        data: {
          eventId,
          userId: recipient.userId,
          template: built.template,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        logger.info(
          { eventId, userId: recipient.userId },
          "Email already claimed — skipped (at-most-once)"
        );
        continue;
      }
      // Transitoire (Mongo down) : on laisse remonter — le handler
      // amont re-livrera, les claims existants protègent du doublon.
      throw err;
    }

    try {
      await sendTemplatedEmail({
        to: user.email,
        subject: built.subject,
        templatesDir: TEMPLATES_DIR,
        template: built.template,
        // subject injecté : les gabarits le reprennent dans <title>.
        data: { ...built.data, subject: built.subject },
      });
      await prisma.emailDelivery.update({
        where: {
          eventId_userId: { eventId, userId: recipient.userId },
        },
        data: { status: "SENT", sentAt: new Date() },
      });
      logger.info(
        { eventId, userId: recipient.userId, template: built.template },
        "Booking email sent"
      );
    } catch (err) {
      // Best-effort : FAILED tracé (rejeu manuel), JAMAIS de throw —
      // l'email ne bloque ni la partition ni l'in-app.
      logger.error(
        { eventId, userId: recipient.userId, err },
        "Booking email send failed — marked FAILED"
      );
      try {
        await prisma.emailDelivery.update({
          where: {
            eventId_userId: { eventId, userId: recipient.userId },
          },
          data: { status: "FAILED", lastError: errorMessage(err) },
        });
      } catch (markErr) {
        logger.error(
          { eventId, userId: recipient.userId, err: markErr },
          "Could not mark email delivery FAILED"
        );
      }
    }
  }
}
