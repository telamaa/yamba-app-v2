/**
 * backfill-comparable-price.ts — D33 : calcule `comparablePriceCents` pour
 * tous les trajets existants (une fois, idempotent).
 *   npx tsx packages/libs/prisma/scripts/backfill-comparable-price.ts
 */
import { PrismaClient } from "@prisma/client";

const REFERENCE_KG = 2;
const MIN_TRANSPORT_CENTS = 800;
const prisma = new PrismaClient();

(async () => {
  const trips = await prisma.trip.findMany({
    select: { id: true, pricePerKgCents: true, minPriceCents: true, comparablePriceCents: true },
  });
  let updated = 0;
  for (const t of trips) {
    const next =
      t.pricePerKgCents != null && t.pricePerKgCents > 0
        ? Math.max(Math.round(t.pricePerKgCents * REFERENCE_KG), MIN_TRANSPORT_CENTS)
        : t.minPriceCents != null && t.minPriceCents > 0
          ? t.minPriceCents
          : null;
    if (next !== t.comparablePriceCents) {
      await prisma.trip.update({ where: { id: t.id }, data: { comparablePriceCents: next } });
      updated++;
    }
  }
  console.log(`backfill comparablePriceCents : ${trips.length} trips lus, ${updated} mis à jour`);
  await prisma.$disconnect();
})();
