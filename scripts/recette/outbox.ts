/** Événements d'outbox d'un agrégat. */
import prisma from "../../packages/libs/prisma";
(async () => {
  const ev = await prisma.outboxEvent.findMany({ where: { aggregateId: process.argv[2] }, select: { eventType: true, payload: true, publishedAt: true, occurredAt: true }, orderBy: { occurredAt: "asc" } });
  for (const e of ev as any[]) console.log(`${e.eventType.padEnd(34)} publié=${e.publishedAt ? "oui" : "non"}  ${JSON.stringify(e.payload?.amountCents ?? "")}`);
  console.log("total :", ev.length);
  process.exit(0);
})();
