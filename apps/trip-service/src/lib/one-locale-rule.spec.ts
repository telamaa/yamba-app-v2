import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Dette D-1 du rapport de recette API (fiches API-GW-10, API-MSG-11).
 *
 * Le journal la présentait comme un arbitrage à rendre : « soit l'en-tête prime, soit le cahier est
 * corrigé ». L'arbitrage était en fait **déjà rendu**, au registre : **D44** — « une locale par
 * UTILISATEUR, pas par appareil », le front tenant `preferredLocale` à jour à chaque bascule
 * (`PATCH /auth/me/locale`).
 *
 * Ce qui manquait n'était donc pas la décision, c'était son ÉCRITURE. Trois endpoints résolvaient
 * la langue de trois façons :
 *   · les réponses rapides   → `preferredLocale` puis `x-locale` (juste) ;
 *   · les favoris            → `?locale` puis `x-locale` — le membre jamais consulté ;
 *   · la recherche           → `?locale` seul, défaut `fr` — ni membre ni appareil.
 *
 * Aucune n'était fausse isolément ; ensemble, elles n'étaient pas la même règle. Ce test interdit
 * qu'une quatrième apparaisse : dans un contrôleur, la langue d'une réponse se résout par
 * `resolveViewerLocale`, jamais à la main.
 */
describe("trip-service — une seule règle pour la langue d'une réponse (D-1)", () => {
  const controleurs = join(__dirname, "../controllers");

  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return fichiers(p);
      return p.endsWith(".ts") && !p.endsWith(".spec.ts") ? [p] : [];
    });

  const sources = () => fichiers(controleurs).map((f) => ({ nom: f.split("/").pop()!, code: readFileSync(f, "utf-8") }));

  it("le test lit bien les contrôleurs (garde-fou du garde-fou)", () => {
    expect(sources().length).toBeGreaterThanOrEqual(4);
  });

  it("aucun contrôleur ne lit `x-locale` sans passer par la règle commune", () => {
    const fautifs = sources()
      .filter(({ code }) => code.includes('"x-locale"') && !code.includes("resolveViewerLocale"))
      .map(({ nom }) => nom);
    expect(fautifs).toEqual([]);
  });

  it("la recherche consulte la langue du membre, pas seulement le paramètre", () => {
    const code = sources().find(({ nom }) => nom === "trip-search.controller.ts")!.code;
    expect(code).toContain("resolveViewerLocale");
    expect(code).toContain("preferredLocale");
    // Le défaut du schéma ne doit plus être le seul recours : la locale est résolue AVANT l'analyse.
    expect(code).toMatch(/safeParse\(\{ \.\.\.req\.query, locale: localeDeLaRequete\(req\) \}\)/);
  });

  it("les favoris consultent la langue du membre", () => {
    const code = sources().find(({ nom }) => nom === "trip-favorite.controller.ts")!.code;
    expect(code).toContain("resolveViewerLocale");
    expect(code).toContain("preferredLocale");
  });
});
