/**
 * backfill-reserved-kg.ts — A34 : matérialise `reservedKg: 0` sur les trajets
 * créés AVANT l'ajout du champ (B2-PR1). Sans lui, le WHERE conditionnel de la
 * réservation (CAP-01) ne matche pas un document où le champ est absent
 * (pitfall Prisma+Mongo `isSet`) → faux CAPACITY_EXCEEDED. Une fois, idempotent.
 *   npx tsx packages/libs/prisma/scripts/backfill-reserved-kg.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  const result = (await prisma.$runCommandRaw({
    update: "Trip",
    updates: [
      {
        q: { reservedKg: { $exists: false } },
        u: { $set: { reservedKg: 0 } },
        multi: true,
      },
    ],
  })) as { n?: number; nModified?: number };
  console.log(`backfill reservedKg : ${result.n ?? 0} trips sans champ, ${result.nModified ?? 0} mis à jour`);
  await prisma.$disconnect();
})();
