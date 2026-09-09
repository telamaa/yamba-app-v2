import prisma from "../../packages/libs/prisma";
(async () => {
  const r = await prisma.outboxEvent.update({ where: { id: process.argv[2] }, data: { publishedAt: null, attempts: 0, lastError: null } });
  console.log("rejeu armé :", r.id, r.eventType);
  process.exit(0);
})();
