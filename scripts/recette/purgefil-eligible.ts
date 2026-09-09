/** Rend une conversation purgeable (deal terminal + inactivité > rétention). */
import prisma from "../../packages/libs/prisma";
(async () => {
  const ID = process.argv[2];
  const jours = Number(process.argv[3] ?? 400);
  const vieux = new Date(Date.now() - jours * 86_400_000);
  const c: any = await prisma.conversation.findUnique({ where: { id: ID }, select: { bookingId: true } });
  await prisma.booking.update({ where: { id: c.bookingId }, data: { status: "COMPLETED", completedAt: vieux, closedAt: vieux } as never });
  await prisma.$runCommandRaw({ update: "Conversation", updates: [{ q: { _id: { $oid: ID } }, u: { $set: { updatedAt: { $date: vieux.toISOString() } } }, multi: false }] });
  const compte = {
    messages: await prisma.message.count({ where: { conversationId: ID } }),
    meetups: await prisma.meetup.count({ where: { conversationId: ID } }),
    reveals: await prisma.phoneReveal.count({ where: { conversationId: ID } }),
    reports: await prisma.report.count({ where: { targetType: "MESSAGE" } }),
  };
  console.log("préparée :", ID, "| avant purge :", JSON.stringify(compte));
  process.exit(0);
})();
