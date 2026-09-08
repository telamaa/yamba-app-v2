import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ANO-API-04 (recette API du 08/09/2026, fiche API-GW-19, mineure) — dernier écart ouvert de la
 * campagne. Le 409 `TRANSITION_NOT_ALLOWED` disait « Action "accept" is not allowed from status
 * ACCEPTED. » : la donnée utile (le statut réellement vu par le serveur) n'existait que dans une
 * phrase anglaise. Et, au passage, les 403 et 404 métier du service ne portaient AUCUN code —
 * `Only the carrier can accept this deal.`, `Deal not found.` : impossible pour le front de
 * distinguer un droit manquant d'une ressource absente sans lire le texte.
 *
 * C'est le même défaut qu'ANO-API-20, fermé pour message-service. Ce test-ci porte la règle sur
 * deal-service — le service de l'argent, donc celui où un refus mal compris coûte le plus cher.
 *
 * Il lit les SOURCES du service et refuse tout jet d'erreur métier sans `code:`. Les erreurs de
 * FORME (schéma Zod dans les contrôleurs) en sont exclues : elles portent déjà la liste des champs
 * fautifs, qui est leur contrat.
 */
describe("deal-service — tout refus métier porte un `details.code`", () => {
  const racines = [join(__dirname), join(__dirname, "../lib"), join(__dirname, "../controllers")];

  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return fichiers(p);
      return p.endsWith(".ts") && !p.endsWith(".spec.ts") ? [p] : [];
    });

  /** Le contenu d'un appel `Erreur(...)` dont la parenthèse ouvrante vient d'être consommée. */
  const argumentsDe = (code: string, apresParenthese: number): string => {
    let i = apresParenthese;
    let profondeur = 1;
    while (i < code.length && profondeur > 0) {
      if (code[i] === "(") profondeur++;
      else if (code[i] === ")") profondeur--;
      i++;
    }
    return code.slice(apresParenthese, i - 1);
  };

  const jets = (): Array<{ fichier: string; ligne: number; classe: string; args: string }> => {
    const trouves: Array<{ fichier: string; ligne: number; classe: string; args: string }> = [];
    for (const f of racines.flatMap(fichiers)) {
      const code = readFileSync(f, "utf-8");
      for (const m of code.matchAll(/new (ValidationError|ForbiddenError|NotFoundError|ConflictError|AuthError)\(/g)) {
        trouves.push({
          fichier: f.slice(f.indexOf("/src/") + 5),
          ligne: code.slice(0, m.index).split("\n").length,
          classe: m[1],
          args: argumentsDe(code, m.index! + m[0].length),
        });
      }
    }
    return trouves;
  };

  it("le test trouve bien des refus à vérifier (garde-fou du garde-fou)", () => {
    expect(jets().length).toBeGreaterThanOrEqual(30);
  });

  it("aucun refus métier ne part sans code", () => {
    const sansCode = jets()
      // Les erreurs de FORME (schéma Zod des contrôleurs) portent déjà `errors` : c'est leur
      // contrat, et le client y lit le champ fautif. Tout le reste doit porter un code.
      .filter((j) => !/code:/.test(j.args) && !/errors/.test(j.args) && !/parsed\.error|zodErrors|Invalid /.test(j.args))
      .map((j) => `${j.fichier}:${j.ligne} → ${j.classe}`);
    expect(sansCode).toEqual([]);
  });

  it("aucun 403 ni 404 métier ne part sans code — c'est le cœur d'ANO-API-04", () => {
    const sansCode = jets()
      .filter((j) => (j.classe === "ForbiddenError" || j.classe === "NotFoundError") && !/code:/.test(j.args))
      .map((j) => `${j.fichier}:${j.ligne} → ${j.classe}`);
    expect(sansCode).toEqual([]);
  });
});
