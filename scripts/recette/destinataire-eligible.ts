import prisma from "../../packages/libs/prisma";
(async () => {
  const [ID, jours] = process.argv.slice(2);
  const vieux = new Date(Date.now() - Number(jours ?? 40) * 86_400_000);
  const b: any = await prisma.booking.update({ where: { id: ID }, data: { status: "COMPLETED", completedAt: vieux, closedAt: vieux, recipientRedactedAt: null } as never, select: { status: true, completedAt: true, recipient: true, recipientRedactedAt: true } });
  console.log(JSON.stringify({ status: b.status, completedAt: b.completedAt, recipient: b.recipient, recipientRedactedAt: b.recipientRedactedAt }));
  process.exit(0);
})();
