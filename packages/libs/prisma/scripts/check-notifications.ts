/**
 * check-notifications.ts — contrôle du smoke E2E PR4bis (jetable)
 * Attendu : ConsumedEvent tous PROCESSED (zéro FAILED, zéro PENDING
 * résiduel), et des Notification réparties selon la matrice A15.
 */
import prisma from "../index";

async function main() {
  const consumed = await prisma.consumedEvent.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const notifs = await prisma.notification.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  const total = await prisma.notification.count();
  console.log("ConsumedEvent par statut :", JSON.stringify(consumed));
  console.log("Notification par type   :", JSON.stringify(notifs));
  console.log(`Notification total : ${total}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
