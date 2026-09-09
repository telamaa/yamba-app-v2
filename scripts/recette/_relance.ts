import prisma from "../../packages/libs/prisma";
(async () => {
  const ev: any[] = await prisma.outboxEvent.findMany({ where: { aggregateId: process.argv[2], eventType: "booking.rating_reminder" }, select: { payload: true } });
  for (const e of ev) { const p = e.payload.payload; console.log(JSON.stringify({ reminderNumber: p.reminderNumber, targetRole: p.targetRole })); }
  const b: any = await prisma.booking.findUnique({ where: { id: process.argv[2] }, select: { ratingRemindersSent: true } });
  console.log("ratingRemindersSent :", b.ratingRemindersSent);
  process.exit(0);
})();
