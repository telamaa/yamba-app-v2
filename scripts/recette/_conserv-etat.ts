import prisma from "../../packages/libs/prisma";
(async () => {
  console.log("Notification :", await prisma.notification.count(), "| EmailDelivery :", await prisma.emailDelivery.count(), "| ConsumedEvent :", await prisma.consumedEvent.count());
  process.exit(0);
})();
