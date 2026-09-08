import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ANO-API-09 (recette API 08/09/2026, fiche API-AUTH-22, bloquante).
 *
 * L'export RGPD répondait 500 : `privacy.service.ts` demandait `ticketNumber` sur `Booking`,
 * un champ qui n'existe que sur `Dispute`. Le service a pourtant ses tests, et ils passaient —
 * ils injectent un faux Prisma, qui ne valide aucun nom de champ. Un mock ne dit jamais ce
 * qui lui manque, ni ce qu'on lui invente.
 *
 * Ce test-ci ne mocke rien : il lit le SOURCE de l'export, en extrait chaque `db.<modèle>...
 * select: { … }`, et confronte les champs demandés au modèle correspondant de
 * `prisma/schema.prisma`. Un champ inventé fait échouer la suite, sans base de données.
 *
 * Même famille que `me-projection.spec.ts` (ANO-API-06) et que le test A145 qui lit les
 * routeurs : faire lire le code par le test plutôt qu'espérer que le mock soit fidèle.
 */
describe("privacy.service — les champs demandés existent vraiment au schéma", () => {
  const racine = join(__dirname, "../../../..");

  /** { Booking: Set{id, disputeTicket, …}, … } — scalaires ET relations. */
  const modeles = (): Record<string, Set<string>> => {
    const schema = readFileSync(join(racine, "prisma/schema.prisma"), "utf-8");
    const out: Record<string, Set<string>> = {};
    for (const m of schema.matchAll(/^model (\w+) \{(.*?)^\}/gms)) {
      out[m[1]] = new Set(
        m[2]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
          .map((l) => l.split(/\s+/)[0])
      );
    }
    return out;
  };

  /** Les appels `db.<modèle>.findX({ … select: { … } })` du service, à plat. */
  const selectsDuService = (): Array<{ modele: string; champs: string[] }> => {
    const src = readFileSync(join(__dirname, "privacy.service.ts"), "utf-8");
    const trouves: Array<{ modele: string; champs: string[] }> = [];
    for (const appel of src.matchAll(/db\.(\w+)\.(?:findMany|findFirst|findUnique)!?\(\{([\s\S]*?)\}\)/g)) {
      const bloc = /select:\s*\{([^}]*)\}/.exec(appel[2]);
      if (!bloc) continue;
      const champs = [...bloc[1].matchAll(/(\w+)\s*:\s*true/g)].map((c) => c[1]);
      if (champs.length) trouves.push({ modele: appel[1], champs });
    }
    return trouves;
  };

  /** `db.booking` → modèle `Booking` (première lettre en majuscule). */
  const nomModele = (accesseur: string) => accesseur.charAt(0).toUpperCase() + accesseur.slice(1);

  it("le test trouve bien les requêtes de l'export (garde-fou du garde-fou)", () => {
    const selects = selectsDuService();
    expect(selects.length).toBeGreaterThanOrEqual(10);
    expect(selects.map((s) => s.modele)).toContain("booking");
  });

  it("aucun `select` ne demande un champ absent du modèle", () => {
    const schema = modeles();
    const fautifs: string[] = [];
    for (const { modele, champs } of selectsDuService()) {
      const connus = schema[nomModele(modele)];
      if (!connus) {
        fautifs.push(`modèle inconnu au schéma : ${modele}`);
        continue;
      }
      for (const champ of champs) {
        if (!connus.has(champ)) fautifs.push(`${nomModele(modele)}.${champ}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le cas exact d'ANO-API-09 reste attrapé : Booking n'a pas de ticketNumber", () => {
    const schema = modeles();
    expect(schema["Booking"].has("ticketNumber")).toBe(false);
    expect(schema["Booking"].has("disputeTicket")).toBe(true);
    expect(schema["Dispute"].has("ticketNumber")).toBe(true);
  });
});
