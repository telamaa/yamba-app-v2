/** Refige un versement en échec « compte Stripe incomplet » et repousse son rejeu d'un jour — le cron des 5 minutes (FAKE) l'aurait fait partir (WEB-CNF-6/7). */
import prisma from "../../packages/libs/prisma";
(async () => {
  const [id] = process.argv.slice(2);
  const b: any = await prisma.booking.update({
    where: { id },
    data: { payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY", transferId: null, payoutSentAt: null, payoutAttempts: 4, payoutLastAttemptAt: new Date(), payoutNextRetryAt: new Date(Date.now() + 86_400_000) },
    select: { id: true, status: true, payoutStatus: true, payoutFailureReason: true, payoutNextRetryAt: true },
  });
  console.log(JSON.stringify(b));
  process.exit(0);
})();
