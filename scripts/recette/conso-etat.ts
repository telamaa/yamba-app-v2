import prisma from "../../packages/libs/prisma";
(async () => {
  const ID = process.argv[2];
  if (ID) {
    const c: any[] = await prisma.consumedEvent.findMany({ where: { eventId: ID }, select: { consumerGroup: true, status: true, lastError: true, processedAt: true } });
    for (const x of c) console.log(`  registre ${x.consumerGroup.padEnd(24)} ${x.status.padEnd(10)} ${String(x.lastError ?? "").slice(0, 50)}`);
    console.log("  notifications :", await prisma.notification.count({ where: { eventId: ID } }), "| traces email :", await prisma.emailDelivery.count({ where: { eventId: ID } }));
  } else {
    const parGroupe: any[] = await prisma.consumedEvent.groupBy({ by: ["consumerGroup", "status"], _count: true } as never);
    for (const g of parGroupe) console.log(`  ${g.consumerGroup.padEnd(24)} ${g.status.padEnd(10)} ${g._count}`);
    console.log("  notifications :", await prisma.notification.count(), "| traces email :", await prisma.emailDelivery.count());
  }
  process.exit(0);
})();
