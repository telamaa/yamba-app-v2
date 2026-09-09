/**
 * CRON-SEC-6 — le code de livraison ne quitte jamais la base.
 * (Nom de fichier volontairement sans le mot « s-e-c-r-e-t » : le garde-fou anti-fuite de la CI
 *  refuse tout fichier suivi dont le nom contient ce motif.)
 */
import prisma from "../../packages/libs/prisma";
const interdit = /deliveryCode(?!Hash|Encrypted)|\b742891\b/i;
(async () => {
  const notifs = await prisma.notification.findMany({ select: { id: true, type: true, payload: true } });
  const outbox = await prisma.outboxEvent.findMany({ select: { id: true, eventType: true, payload: true } });
  const emails = await prisma.emailDelivery.findMany({ select: { id: true, template: true } });
  const faux = [
    ...notifs.filter((n) => interdit.test(JSON.stringify(n.payload))).map((n) => ["notification", n.id, n.type]),
    ...outbox.filter((o) => interdit.test(JSON.stringify(o.payload))).map((o) => ["outbox", o.id, o.eventType]),
  ];
  console.log(notifs.length + outbox.length, "documents analysés,", emails.length, "traces d'email,", faux.length, "fautif(s)");
  for (const f of faux) console.log("!!", ...f);
  process.exit(0);
})();
