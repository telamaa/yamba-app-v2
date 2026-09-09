import prisma from "../../packages/libs/prisma";
(async () => {
  const c: any = await prisma.conversation.findUnique({ where: { id: process.argv[2] }, select: { id: true, lastMessageAt: true, lastMessageAuthorRole: true, shipperLastReadAt: true, carrierLastReadAt: true, shipperRemindedAt: true, carrierRemindedAt: true } });
  console.log(JSON.stringify(c, null, 1));
  process.exit(0);
})();
