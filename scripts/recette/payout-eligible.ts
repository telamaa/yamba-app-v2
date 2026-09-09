/** Rend une réservation éligible à une des trois passes de payout-bookings. */
import prisma from "../../packages/libs/prisma";
const [ID, MODE] = process.argv.slice(2);
const h = (n: number) => new Date(Date.now() + n * 3_600_000);
(async () => {
  const data: any =
    MODE === "due"
      ? { status: "DELIVERED", payoutDueAt: h(-1), payoutStatus: null, transferId: null, payoutSentAt: null }
      : MODE === "retry"
        ? { status: "COMPLETED", payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY", payoutNextRetryAt: h(-1), payoutAttempts: 1 }
        : { status: "DELIVERED", payoutDueAt: h(6), verificationReminderSentAt: null };
  const b: any = await prisma.booking.update({ where: { id: ID }, data, select: { id: true, status: true, payoutStatus: true, payoutDueAt: true, payoutNextRetryAt: true, payoutAttempts: true, pricing: true } });
  console.log(JSON.stringify({ mode: MODE, status: b.status, payoutStatus: b.payoutStatus, payoutDueAt: b.payoutDueAt, payoutNextRetryAt: b.payoutNextRetryAt, transportCents: b.pricing?.transportCents }));
  process.exit(0);
})();
