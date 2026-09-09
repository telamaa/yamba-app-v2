/** État argent d'une réservation. */
import prisma from "../../packages/libs/prisma";
(async () => {
  const b: any = await prisma.booking.findUnique({ where: { id: process.argv[2] }, select: { status: true, completedAt: true, completedBy: true, payoutStatus: true, payoutAmountCents: true, transferId: true, payoutSentAt: true, payoutAttempts: true, payoutFailureReason: true, payoutNextRetryAt: true, ratingWindowEndsAt: true, ratingRemindersSent: true, verificationReminderSentAt: true, pricing: true } });
  console.log(JSON.stringify({ ...b, pricing: { transportCents: b?.pricing?.transportCents, totalShipperCents: b?.pricing?.totalShipperCents } }, null, 1));
  process.exit(0);
})();
