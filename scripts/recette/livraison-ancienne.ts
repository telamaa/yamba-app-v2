/** Recule la remise d'une réservation DELIVERED : deliveredAt = maintenant − <jours>, payoutDueAt = deliveredAt + 4 j (WEB-CNF-3/4/5). */
import prisma from "../../packages/libs/prisma";
(async () => {
  const [id, jours] = process.argv.slice(2);
  const deliveredAt = new Date(Date.now() - Number(jours ?? 4.1) * 86_400_000);
  const payoutDueAt = new Date(deliveredAt.getTime() + 4 * 86_400_000);
  const b: any = await prisma.booking.update({
    where: { id },
    data: { deliveredAt, payoutDueAt },
    select: { id: true, status: true, deliveredAt: true, payoutDueAt: true, verificationReminderSentAt: true },
  });
  console.log(JSON.stringify(b));
  process.exit(0);
})();
