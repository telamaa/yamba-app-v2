/**
 * repair-absent-lists.ts — pose les listes absentes sur les bookings existants (A85)
 * ==================================================================================
 * Pitfall Prisma+Mongo (4e occurrence) : une liste composite ou scalaire ABSENTE
 * du document n'est matchée par aucun filtre Prisma (`none`, `isEmpty`,
 * `equals: []`). Les bookings créés par l'API avant ce correctif n'ont ni
 * `trackingEvents` ni `deliveryPhotoUrls`. Ce script les pose à `[]`, une
 * fois, via une commande Mongo brute ($exists) — Prisma ne sait pas exprimer
 * « champ absent » sur une liste.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/repair-absent-lists.ts
 */
import prisma from "../index";

async function main() {
  for (const field of ["trackingEvents", "deliveryPhotoUrls"] as const) {
    const before = (await prisma.$runCommandRaw({ count: "Booking", query: { [field]: { $exists: false } } })) as { n: number };
    const res = (await prisma.$runCommandRaw({
      update: "Booking",
      updates: [{ q: { [field]: { $exists: false } }, u: { $set: { [field]: [] } }, multi: true }],
    })) as { n: number; nModified: number };
    console.log(`✓ ${field} : ${before.n} document(s) sans le champ → ${res.nModified} réparé(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
