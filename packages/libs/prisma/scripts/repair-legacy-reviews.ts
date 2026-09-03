/**
 * repair-legacy-reviews.ts — les avis d'avant B5 sont publics (revealedAt = createdAt)
 * ====================================================================================
 * Avant le double-aveugle (D53), un avis était public dès sa création. Les
 * avis historiques (seed, tests) n'ont pas de `revealedAt` ; sans lui, le
 * profil public (filtre `revealedAt: { not: null }`) les cacherait. Une fois.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/repair-legacy-reviews.ts
 */
import prisma from "../index";

async function main() {
  const res = (await prisma.$runCommandRaw({
    update: "Review",
    updates: [{ q: { $or: [{ revealedAt: { $exists: false } }, { revealedAt: null }] }, u: [{ $set: { revealedAt: "$createdAt" } }], multi: true }],
  })) as { n: number; nModified: number };
  console.log(`✓ avis historiques révélés : ${res.nModified} / ${res.n}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
