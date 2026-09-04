/**
 * unread-reminder.service.ts — la relance email des messages non lus (F-PR3, D61 6A)
 * ====================================================================================
 * Toutes les 5 minutes : les conversations dont le dernier message a plus de 15 minutes
 * (et moins de 7 jours — au-delà, relancer serait du bruit) sont passées à la règle pure
 * pour chacun des deux rôles. Une relance due est d'abord RÉCLAMÉE par un `updateMany`
 * conditionnel sur l'ancienne valeur de `<role>RemindedAt` (verrou optimiste, sans Redis) :
 * deux instances ne relancent jamais deux fois. L'email ne cite pas le message.
 */
import prisma from "@packages/libs/prisma";
import { sendTransactionalEmail } from "@packages/email";
import { UNREAD_REMINDER_DELAY_MINUTES } from "@packages/api-contracts";
import { unreadReminderDue, type ReminderRole } from "../lib/unread-reminder.rules";
import { messagingEmailsFor } from "../emails/messaging-emails";

const MIN = 60_000;
const DAY = 86_400_000;
const SCAN_WINDOW_DAYS = 7;
const BATCH = 200;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

type ConversationRow = {
  id: string;
  bookingId: string;
  shipperId: string;
  carrierId: string;
  lastMessageAt: Date | null;
  lastMessageAuthorRole: string | null;
  shipperLastReadAt: Date | null;
  carrierLastReadAt: Date | null;
  shipperRemindedAt: Date | null;
  carrierRemindedAt: Date | null;
};

export type UnreadReminderService = ReturnType<typeof makeUnreadReminderService>;

export function makeUnreadReminderService(deps: { send?: typeof sendTransactionalEmail; clock?: () => Date } = {}) {
  const send = deps.send ?? sendTransactionalEmail;
  const clock = deps.clock ?? (() => new Date());

  /** Réclame la relance : ne gagne que si `<role>RemindedAt` vaut encore ce qu'on a lu. */
  async function claim(conversation: ConversationRow, role: ReminderRole, now: Date): Promise<boolean> {
    const field = role === "SHIPPER" ? "shipperRemindedAt" : "carrierRemindedAt";
    const previous = conversation[field];
    const guard = previous ? { [field]: previous } : { OR: [{ [field]: null }, { [field]: { isSet: false } }] };
    const result = await prisma.conversation.updateMany({ where: { id: conversation.id, ...guard } as never, data: { [field]: now } });
    return result.count === 1;
  }

  async function remind(conversation: ConversationRow, role: ReminderRole): Promise<void> {
    const recipientId = role === "SHIPPER" ? conversation.shipperId : conversation.carrierId;
    const counterpartId = role === "SHIPPER" ? conversation.carrierId : conversation.shipperId;
    const [recipient, counterpart, booking] = await Promise.all([
      prisma.user.findUnique({ where: { id: recipientId }, select: { email: true, firstName: true, preferredLocale: true, isDeleted: true } }),
      prisma.user.findUnique({ where: { id: counterpartId }, select: { firstName: true } }),
      prisma.booking.findUnique({ where: { id: conversation.bookingId }, select: { trip: { select: { originCity: true, destinationCity: true } } } }),
    ]);
    if (!recipient?.email || recipient.isDeleted || !booking) return;
    const { locale, dictionary } = messagingEmailsFor(recipient.preferredLocale);
    const built = dictionary.unreadReminder({
      firstName: recipient.firstName,
      counterpartFirstName: counterpart?.firstName ?? "—",
      route: `${booking.trip.originCity} → ${booking.trip.destinationCity}`,
      conversationUrl: `${FRONTEND_URL}/${locale}/dashboard/messages?conversation=${conversation.id}`,
    });
    await send({ to: recipient.email, locale, subject: built.subject, content: built.content });
  }

  return {
    /** Un passage : renvoie le nombre de relances envoyées. Les erreurs d'envoi ne bloquent pas les autres fils. */
    async runOnce(now: Date = clock()): Promise<{ scanned: number; sent: number; failed: number }> {
      const rows = (await prisma.conversation.findMany({
        where: { lastMessageAt: { lte: new Date(now.getTime() - UNREAD_REMINDER_DELAY_MINUTES * MIN), gte: new Date(now.getTime() - SCAN_WINDOW_DAYS * DAY) } },
        orderBy: { lastMessageAt: "asc" },
        take: BATCH,
      })) as ConversationRow[];
      let sent = 0;
      let failed = 0;
      for (const conversation of rows) {
        for (const role of ["SHIPPER", "CARRIER"] as const) {
          const verdict = unreadReminderDue(
            {
              lastMessageAt: conversation.lastMessageAt,
              lastMessageAuthorRole: conversation.lastMessageAuthorRole,
              recipientRole: role,
              recipientLastReadAt: role === "SHIPPER" ? conversation.shipperLastReadAt : conversation.carrierLastReadAt,
              recipientRemindedAt: role === "SHIPPER" ? conversation.shipperRemindedAt : conversation.carrierRemindedAt,
            },
            now
          );
          if (!verdict.due) continue;
          if (!(await claim(conversation, role, now))) continue;
          try {
            await remind(conversation, role);
            sent += 1;
          } catch {
            failed += 1;
          }
        }
      }
      return { scanned: rows.length, sent, failed };
    },
  };
}
