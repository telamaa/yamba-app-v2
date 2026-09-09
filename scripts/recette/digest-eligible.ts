import prisma from "../../packages/libs/prisma";
const [ID, MODE] = process.argv.slice(2);
(async () => {
  const vieux = new Date(Date.now() - 30 * 3_600_000);
  const data: any =
    MODE === "failed" ? { status: "COMPLETED", payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY", completedAt: vieux }
    : MODE === "reversed" ? { payoutStatus: "REVERSED", payoutReversalResolution: null }
    : { status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", closedAt: vieux, closedBy: "SYSTEM" };
  const b: any = await prisma.booking.update({ where: { id: ID }, data, select: { status: true, payoutStatus: true, retentionDisposition: true } });
  if (MODE === "failed") await prisma.$runCommandRaw({ update: "Booking", updates: [{ q: { _id: { $oid: ID } }, u: { $set: { updatedAt: { $date: vieux.toISOString() } } }, multi: false }] });
  console.log(MODE, "→", JSON.stringify(b));
  process.exit(0);
})();
