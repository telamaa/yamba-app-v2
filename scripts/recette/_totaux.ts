/** Totaux des collections sensibles — pour CRON-SEC-2. */
import prisma from "../../packages/libs/prisma";
export async function totaux(): Promise<Record<string, number>> {
  const [outboxBooking, outboxConv, conversation, message, meetup, phoneReveal, notification, emailDelivery, consumedEvent, booking, trip, user, dispute, review, report, recipientNonNul] = await Promise.all([
    prisma.outboxEvent.count({ where: { aggregateType: "booking" } }),
    prisma.outboxEvent.count({ where: { aggregateType: "conversation" } }),
    prisma.conversation.count(), prisma.message.count(), prisma.meetup.count(), prisma.phoneReveal.count(),
    prisma.notification.count(), prisma.emailDelivery.count(), prisma.consumedEvent.count(),
    prisma.booking.count(), prisma.trip.count(), prisma.user.count(),
    prisma.dispute.count(), prisma.review.count(), prisma.report.count(),
    prisma.$runCommandRaw({ count: "Booking", query: { recipient: { $ne: null } } }).then((r) => (r as { n: number }).n),
  ]);
  return { outboxBooking, outboxConv, conversation, message, meetup, phoneReveal, notification, emailDelivery, consumedEvent, booking, trip, user, dispute, review, report, recipientNonNul };
}
if (require.main === module) totaux().then((t) => { console.log(JSON.stringify(t)); process.exit(0); });
