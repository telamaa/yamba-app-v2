import prisma from "../../packages/libs/prisma";
(async () => {
  const absent = { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] } as never;
  const baux: any[] = await prisma.relayLease.findMany();
  for (const b of baux) console.log(`bail ${String(b.id).padEnd(16)} propriétaire ${String(b.owner).slice(0, 28).padEnd(30)} expire ${b.expiresAt?.toISOString()}`);
  console.log("non publiés :", await prisma.outboxEvent.count({ where: absent }), "| parqués :", await prisma.outboxEvent.count({ where: { ...(absent as object), attempts: { gte: 10 } } as never }));
  const q: any[] = await prisma.outboxEvent.findMany({ where: absent, orderBy: { occurredAt: "asc" }, take: 5, select: { aggregateType: true, eventType: true, occurredAt: true, attempts: true, lastError: true } });
  for (const e of q) console.log(`  ${e.aggregateType}/${e.eventType} · ${e.attempts} tentative(s) · ${String(e.lastError ?? "").slice(0, 60)}`);
  process.exit(0);
})();
