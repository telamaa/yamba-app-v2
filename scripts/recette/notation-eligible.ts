/** Rend une réservation éligible à une passe de la tâche `rating`. */
import prisma from "../../packages/libs/prisma";
const [ID, MODE] = process.argv.slice(2);
const d = (n: number) => new Date(Date.now() + n * 86_400_000);
(async () => {
  const data: any =
    MODE === "r1" ? { status: "COMPLETED", completedAt: d(-6), ratingWindowEndsAt: d(8), ratingRemindersSent: 0, ratingsRevealedAt: null }
    : MODE === "r2" ? { status: "COMPLETED", completedAt: d(-8), ratingWindowEndsAt: d(6), ratingRemindersSent: 1, ratingsRevealedAt: null }
    : { status: "COMPLETED", completedAt: d(-20), ratingWindowEndsAt: new Date(Date.now() - 3_600_000), ratingsRevealedAt: null };
  const b: any = await prisma.booking.update({ where: { id: ID }, data, select: { status: true, completedAt: true, ratingWindowEndsAt: true, ratingRemindersSent: true, ratingsRevealedAt: true, shipperRatedAt: true, carrierRatedAt: true } });
  console.log(JSON.stringify({ mode: MODE, ...b }));
  process.exit(0);
})();
