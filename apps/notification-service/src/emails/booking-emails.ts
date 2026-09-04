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
 *   email ni prénom) ; user effacé (RGPD) = envoi sauté, tracé.
 * - D44/D45 : la locale est `User.preferredLocale` du DESTINATAIRE ;
 *   la contrepartie est nommée par son PRÉNOM (jointure sur l'autre
 *   partie), le mot de rôle n'est qu'un repli (compte effacé).
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
import { isEmailConfigured, sendTemplatedEmail, sendTransactionalEmail, type EmailContent } from "@packages/email";
import { SETTLEMENT_EMAILS } from "./settlement-emails";
import { resolveLocale, type SupportedLocale } from "@packages/api-contracts";

type BookingDomainEvent = z.infer<typeof BookingDomainEventSchema>;
type BookingEventKey = BookingDomainEvent["eventType"];

const APP_URL = process.env.USER_APP_URL ?? "http://localhost:3000";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@yamba.app";
// D44 — la locale est celle du DESTINATAIRE (User.preferredLocale), jamais de l'acteur.
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
  | "BOTH"
  | "SHIPPER_PLUS_CARRIER_IF_WAS_ACCEPTED"
  | "SHIPPER_IF_FLIGHT_ARRIVED"
  | "TARGET_ROLE"
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
  "booking.tracking_event": "SHIPPER_IF_FLIGHT_ARRIVED", // décision 03/09 (4A) : l'ATTERRISSAGE seul — « préviens le destinataire » ; les autres jalons : in-app seul (anti-spam)
  "booking.code_regenerated": "SHIPPER", // B3/A41 : email de sécurité (sans le code)
  "booking.delivered": "SHIPPER", // B3/A41 : « 3 jours pour confirmer ou signaler » (le Voyageur : in-app seul)
  "booking.completed": "SHIPPER", // B4/D52 : « paiement libéré » (le Voyageur reçoit payout_sent, pas deux emails)
  "booking.payout_sent": "CARRIER", // B4/D52 : montant net, « parti vers ton compte, 2 à 7 jours »
  "booking.disputed": "BOTH", // B4/D52 : accusé à l'Expéditeur, information calme au Voyageur
  "booking.verification_reminder": "SHIPPER", // B4/A70 : J+3, dernier jour
  "booking.rating_reminder": "TARGET_ROLE", // B5 (décision 4A) : J+5 et J+7 au rôle qui n'a pas noté, puis silence
  "booking.rating_revealed": null, // JAMAIS : in-app seul
  "booking.dispute_carrier_responded": null, // C-PR2 (D55) : l'admin le voit dans la file, personne d'autre
  "booking.dispute_resolved": "BOTH", // C-PR2 (D55, 5A) : « Décision rendue » aux deux, chacun son montant
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
    case "BOTH":
      return [shipper, carrier];
    case "TARGET_ROLE":
      return event.eventType === "booking.rating_reminder" ? [event.payload.targetRole === "CARRIER" ? carrier : shipper] : [];
    case "SHIPPER_IF_FLIGHT_ARRIVED":
      return event.eventType === "booking.tracking_event" && event.payload.step === "FLIGHT_ARRIVED" ? [shipper] : [];
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
  /** Relatif à templates/, sans .ejs — aussi tracé dans EmailDelivery.
   *  Pour les emails D44 (`content` présent) : identifiant logique `settlement/…`, aucun fichier. */
  template: string;
  data: Record<string, unknown>;
  /** D44/D52 — contenu structuré rendu par le gabarit partagé (`sendTransactionalEmail`) ; les emails B4 l'utilisent. */
  content?: EmailContent;
};

export type BuildBookingEmailOptions = {
  /** Locale du destinataire (brute ou résolue) — repli fr. */
  locale?: string | null;
  /** Prénom de l'AUTRE partie (D45) — null si compte effacé : le gabarit replie sur le rôle. */
  counterpartFirstName?: string | null;
};

export function buildBookingEmail(
  event: BookingDomainEvent,
  role: "SHIPPER" | "CARRIER",
  recipientFirstName: string,
  options: BuildBookingEmailOptions = {}
): BuiltEmail | null {
  const locale: SupportedLocale = resolveLocale(options.locale);
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
    counterpartFirstName: options.counterpartFirstName ?? null,
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
          // D50/A82 — remboursement partiel : la retenue revient au Voyageur.
          retainedForCarrier:
            event.payload.amountCents < p.totalShipperCents
              ? formatMoney(p.totalShipperCents - event.payload.amountCents, p.currencyCode, locale)
              : null,
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
    case "booking.tracking_event": {
      // 4A — seul l'atterrissage a un email (les autres jalons sont filtrés par la matrice).
      if (event.payload.step !== "FLIGHT_ARRIVED") return null;
      const built = SETTLEMENT_EMAILS[locale].flightArrivedShipper({ ...base });
      return { subject: built.subject, template: "settlement/flight-arrived-shipper", data: {}, content: built.content };
    }
    // ── B4 (D52) — dictionnaires par langue, gabarit partagé D44 ──
    case "booking.completed": {
      const built = SETTLEMENT_EMAILS[locale].completedShipper({
        ...base,
        transport: formatMoney(p.transportCents, p.currencyCode, locale),
        completedBy: event.payload.completedBy === "SHIPPER" ? "SHIPPER" : "SYSTEM",
        rateUrl: `${ctaUrl}/rate`, // B5 (4A) : le bouton « Noter » revient
      });
      return { subject: built.subject, template: "settlement/completed-shipper", data: {}, content: built.content };
    }
    case "booking.payout_sent": {
      const built = SETTLEMENT_EMAILS[locale].payoutSentCarrier({
        ...base,
        amount: formatMoney(event.payload.amountCents, p.currencyCode, locale),
        reason: event.payload.reason === "LATE_CANCELLATION" ? "LATE_CANCELLATION" : "DELIVERY", // A82
      });
      return { subject: built.subject, template: "settlement/payout-sent-carrier", data: {}, content: built.content };
    }
    case "booking.disputed": {
      const built =
        role === "SHIPPER"
          ? SETTLEMENT_EMAILS[locale].disputedShipper({ ...base, ticketNumber: event.payload.ticketNumber, supportEmail: SUPPORT_EMAIL })
          : SETTLEMENT_EMAILS[locale].disputedCarrier({
              ...base,
              ticketNumber: event.payload.ticketNumber,
              disputeCategory: event.payload.disputeCategory ?? null,
              supportEmail: SUPPORT_EMAIL,
            });
      return {
        subject: built.subject,
        template: role === "SHIPPER" ? "settlement/disputed-shipper" : "settlement/disputed-carrier",
        data: {},
        content: built.content,
      };
    }
    case "booking.dispute_resolved": {
      const params = {
        ...base,
        kind: event.payload.kind,
        outcome: event.payload.outcome,
        ticketNumber: event.payload.ticketNumber,
        refund: event.payload.refundCents > 0 ? formatMoney(event.payload.refundCents, p.currencyCode, locale) : "",
        carrierPayout: event.payload.carrierPayoutCents > 0 ? formatMoney(event.payload.carrierPayoutCents, p.currencyCode, locale) : "",
        reason: event.payload.reason,
        supportEmail: SUPPORT_EMAIL,
      };
      const built = role === "SHIPPER" ? SETTLEMENT_EMAILS[locale].disputeResolvedShipper(params) : SETTLEMENT_EMAILS[locale].disputeResolvedCarrier(params);
      return { subject: built.subject, template: `settlement/dispute-resolved-${role.toLowerCase()}`, data: {}, content: built.content };
    }
    case "booking.rating_reminder": {
      const built = SETTLEMENT_EMAILS[locale].ratingReminder({ ...base, reminderNumber: event.payload.reminderNumber, rateUrl: `${ctaUrl}/rate` });
      return { subject: built.subject, template: `settlement/rating-reminder-${role.toLowerCase()}`, data: {}, content: built.content };
    }
    case "booking.verification_reminder": {
      const built = SETTLEMENT_EMAILS[locale].verificationReminderShipper({
        ...base,
        payoutDueAt: formatDate(event.payload.payoutDueAt, locale),
        transport: formatMoney(p.transportCents, p.currencyCode, locale),
      });
      return { subject: built.subject, template: "settlement/verification-reminder-shipper", data: {}, content: built.content };
    }
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

  // D44/D45 : on charge les DEUX parties — le destinataire (email, locale)
  // et la contrepartie (prénom), même quand une seule reçoit l'email.
  const partyIds = Array.from(
    new Set([...recipients.map((r) => r.userId), event.payload.shipperId, event.payload.carrierId])
  );
  const users = await prisma.user.findMany({
    where: { id: { in: partyIds } },
    select: { id: true, email: true, firstName: true, preferredLocale: true },
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

    const counterpartId =
      recipient.role === "SHIPPER" ? event.payload.carrierId : event.payload.shipperId;
    const built = buildBookingEmail(event, recipient.role, user.firstName, {
      locale: user.preferredLocale,
      counterpartFirstName: byId.get(counterpartId)?.firstName ?? null,
    });
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
      if (built.content) {
        // D44 — gabarit partagé, contenu en données (emails B4).
        await sendTransactionalEmail({
          to: user.email,
          locale: resolveLocale(user.preferredLocale),
          subject: built.subject,
          content: built.content,
        });
      } else {
        await sendTemplatedEmail({
          to: user.email,
          subject: built.subject,
          templatesDir: TEMPLATES_DIR,
          template: built.template,
          // subject injecté : les gabarits le reprennent dans <title>.
          data: { ...built.data, subject: built.subject },
        });
      }
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
