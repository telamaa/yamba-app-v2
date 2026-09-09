/** Rend une conversation éligible à la relance pour un rôle donné. */
import prisma from "../../packages/libs/prisma";
const [ID, ROLE] = process.argv.slice(2);
(async () => {
  const auteur = ROLE === "SHIPPER" ? "CARRIER" : "SHIPPER"; // on ne relance jamais l'auteur
  const vieux = new Date(Date.now() - 60 * 60_000);
  const c: any = await prisma.conversation.update({
    where: { id: ID },
    data: { lastMessageAt: vieux, lastMessageAuthorRole: auteur, shipperLastReadAt: null, carrierLastReadAt: null, shipperRemindedAt: null, carrierRemindedAt: null } as never,
    select: { id: true, lastMessageAt: true, lastMessageAuthorRole: true, shipperRemindedAt: true, carrierRemindedAt: true },
  });
  console.log(JSON.stringify(c));
  process.exit(0);
})();
