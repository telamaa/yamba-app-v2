import prisma from "../../packages/libs/prisma";
(async () => {
  for (const t of ["booking", "conversation"]) {
    const total = await prisma.outboxEvent.count({ where: { aggregateType: t } });
    const publies = await prisma.outboxEvent.count({ where: { aggregateType: t, publishedAt: { not: null } } as never });
    const parques = await prisma.outboxEvent.count({ where: { aggregateType: t, OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }], attempts: { gte: 10 } } as never });
    console.log(`${t.padEnd(13)} total ${String(total).padStart(4)} · publiés ${String(publies).padStart(4)} · parqués ${parques}`);
  }
  process.exit(0);
})();
