/** État de la boîte d'envoi : non publiés, parqués, plus ancien. */
import prisma from "../../packages/libs/prisma";
(async () => {
  const parked: any[] = await prisma.outboxEvent.findMany({ where: { attempts: { gte: 10 }, publishedAt: null } as never, select: { id: true, aggregateType: true, eventType: true, attempts: true, lastError: true, occurredAt: true }, take: 20 });
  console.log("=== parqués (≥ 10 tentatives, jamais publiés) :", parked.length, "===");
  for (const e of parked) console.log(` ${e.aggregateType}/${e.eventType} — ${e.attempts} tentatives — ${String(e.lastError).slice(0, 130)}`);
  const nonPub: any[] = await prisma.outboxEvent.findMany({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] } as never, select: { eventType: true, attempts: true, occurredAt: true }, orderBy: { occurredAt: "asc" }, take: 5 });
  console.log("\n=== non publiés (5 plus anciens) :", nonPub.length, "===");
  for (const e of nonPub) console.log(` ${e.eventType} — ${e.attempts ?? 0} tentative(s) — ${e.occurredAt.toISOString()}`);
  process.exit(0);
})();
