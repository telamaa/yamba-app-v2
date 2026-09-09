/**
 * repair-negative-counters.ts — remet à zéro les compteurs publics devenus négatifs
 * ==================================================================================
 * ANO-CRON-01 (recette n° 4, 09/09/2026) — `getCarrierStatDeltas` rendait `{ decrement: 1 }`,
 * appliqué sans plancher par les deux appelants (le contrôleur de trajets et le cron
 * `complete-trips`). Une dérive suffit — un trajet publié avant que le compteur existe, une
 * incrémentation ratée, une correction manuelle — et la page publique du Voyageur affiche
 * « -1 trajet publié ». Mesuré : deux pages sur onze, et le nombre sortait tel quel sur
 * `GET /users/{slug}/public`.
 *
 * Le code est corrigé (`clampedCarrierStats` écrit une valeur bornée) ; ce script répare les
 * documents déjà abîmés. Idempotent, avec `--dry-run`.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/repair-negative-counters.ts [--dry-run]
 */
import prisma from "../index";

/** Collection → compteurs qui ne peuvent pas être négatifs. */
const COMPTEURS: Record<string, string[]> = {
  CarrierPage: ["totalTripsPublished", "totalTripsCancelled", "totalParcelsCarried"],
  User: ["parcelsSentCount", "disputesLostCount"],
};

async function main() {
  const sec = process.argv.includes("--dry-run");
  if (sec) console.log("— simulation, aucune écriture —\n");
  let total = 0;
  for (const [collection, champs] of Object.entries(COMPTEURS)) {
    for (const champ of champs) {
      const avant = (await prisma.$runCommandRaw({ count: collection, query: { [champ]: { $lt: 0 } } })) as { n: number };
      const etiquette = `${collection}.${champ}`.padEnd(34);
      if (avant.n === 0) {
        console.log(`· ${etiquette} rien à faire`);
        continue;
      }
      if (sec) {
        console.log(`· ${etiquette} ${avant.n} document(s) négatif(s) → 0`);
        total += avant.n;
        continue;
      }
      const res = (await prisma.$runCommandRaw({
        update: collection,
        updates: [{ q: { [champ]: { $lt: 0 } }, u: { $set: { [champ]: 0 } }, multi: true }],
      })) as { nModified: number };
      console.log(`✓ ${etiquette} ${avant.n} négatif(s) → ${res.nModified} remis à zéro`);
      total += res.nModified;
    }
  }
  console.log(`\n${sec ? "à réparer" : "réparés"} : ${total} compteur(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
