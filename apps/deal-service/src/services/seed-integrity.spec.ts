import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * seed-integrity.spec.ts — le jeu d'essai doit respecter les règles qu'il sert à éprouver
 * =======================================================================================
 * ANO-CRON-07 (recette crons du 09/09/2026, chapitre 6, mineure). `seed-deals.ts` créait
 * `gru-completed` avec `shipperKey: "ines"` sur le trajet `gru` dont le Voyageur est… `ines`.
 * Le membre était son propre Expéditeur — ce que l'API refuse explicitement (`OWN_TRIP`,
 * `booking-request.ts`), parce qu'un seed écrit en base sans passer par la règle.
 *
 * Le coût n'a pas été théorique : la relance de notation envoyait **deux** emails « Pense à
 * noter Inês » à Inês, ce qui ressemblait trait pour trait à un doublon d'idempotence, et a
 * coûté une investigation en pleine campagne. Un jeu d'essai qui ment fait perdre plus de temps
 * qu'il n'en fait gagner.
 *
 * Ce test ne lance pas le seed et n'ouvre aucune base : il LIT la source, en extrait les trajets
 * et les réservations, et refuse qu'une réservation ait pour Expéditeur le Voyageur de son
 * trajet. Même famille que les gardes de la campagne API (`prisma-select-fields`,
 * `refusal-codes`) : on vérifie une règle sur la source, pas sur un instantané de base.
 */
describe("seed-deals — le jeu d'essai ne viole pas les règles métier", () => {
  const source = readFileSync(join(__dirname, "../../../../packages/libs/prisma/scripts/seed-deals.ts"), "utf-8");

  /** `{ key: "gru", carrierKey: "ines", … }` → { gru: "ines" } */
  const voyageurParTrajet = (code = source): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const m of code.matchAll(/\{\s*key:\s*"([^"]+)",\s*carrierKey:\s*"([^"]+)"/g)) out[m[1]] = m[2];
    return out;
  };

  /** `{ key: "gru-completed", tripKey: "gru", shipperKey: "joao", … }` */
  const reservations = (code = source): Array<{ key: string; tripKey: string; shipperKey: string }> =>
    [...code.matchAll(/\{\s*key:\s*"([^"]+)",\s*tripKey:\s*"([^"]+)",\s*shipperKey:\s*"([^"]+)"/g)].map((m) => ({
      key: m[1],
      tripKey: m[2],
      shipperKey: m[3],
    }));

  /** La règle, isolée pour être éprouvée sur autre chose que la source réelle. */
  const fautives = (code = source): string[] => {
    const voyageurs = voyageurParTrajet(code);
    return reservations(code)
      .filter((b) => voyageurs[b.tripKey] === b.shipperKey)
      .map((b) => `${b.key} : ${b.shipperKey} réserve sur son propre trajet ${b.tripKey}`);
  };

  it("le test trouve bien des trajets et des réservations à vérifier (garde-fou du garde-fou)", () => {
    expect(Object.keys(voyageurParTrajet()).length).toBeGreaterThanOrEqual(7);
    expect(reservations().length).toBeGreaterThanOrEqual(20);
  });

  it("le garde-fou attrape bien le cas exact d'ANO-CRON-07 (un garde qui ne peut pas échouer ne garde rien)", () => {
    const avantCorrection = `
      { key: "gru", carrierKey: "ines", originCity: "Lisbonne" },
      { key: "gru-completed", tripKey: "gru", shipperKey: "ines", status: "COMPLETED" },
    `;
    expect(fautives(avantCorrection)).toEqual(['gru-completed : ines réserve sur son propre trajet gru']);
  });

  it("aucune réservation n'a pour Expéditeur le Voyageur de son trajet (règle OWN_TRIP)", () => {
    expect(fautives()).toEqual([]);
  });

  it("chaque réservation vise un trajet qui existe dans le seed", () => {
    const voyageurs = voyageurParTrajet();
    const orphelines = reservations().filter((b) => !(b.tripKey in voyageurs)).map((b) => b.key);
    expect(orphelines).toEqual([]);
  });
});
