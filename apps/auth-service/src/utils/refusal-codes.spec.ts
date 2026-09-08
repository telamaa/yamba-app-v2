import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Dette D-4 du rapport de recette API (08/09/2026) — la règle non négociable « un refus métier
 * porte un `details.code`, et ce code atteint le client » était tenue par un test sur
 * deal-service (ANO-API-04) et message-service (ANO-API-20), mais **pas** sur trip-service ni
 * auth-service. Le rapport l'avait inscrite au journal de dette plutôt que de la laisser passer.
 *
 * Ce test porte la règle ici. Il lit les SOURCES du service et refuse tout jet d'erreur métier
 * sans `code:`.
 *
 * Deux exclusions, et une seule raison pour chacune :
 * - les erreurs de FORME (schéma Zod) portent déjà la liste des champs fautifs, qui EST leur
 *   contrat — le client y lit quel champ corriger ;
 * - `AppError` brute n'est pas visée : elle sert aux cas déjà typés par leur `details`.
 *
 * auth-service est le plus gros des quatre : **169 refus métier** à coder, dont cinquante
 * `AuthError`. C'est aussi celui où un code compte le plus — le client doit distinguer « mot de
 * passe faux » de « session expirée » de « compte suspendu », qui sont tous des 401.
 */
describe("auth-service — tout refus métier porte un `details.code`", () => {
  const racines = [join(__dirname, "..")];

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

  /**
   * Un code peut être écrit de trois façons, toutes légitimes : `{ code: "X" }`, le raccourci
   * `{ code }` quand la variable porte déjà le nom, et un objet `details` passé tel quel (le cas
   * des favoris, dont le motif est construit ailleurs). Les trois comptent.
   */
  const porteUnCode = (args: string): boolean => /(^|[\s,{])code\s*[,:}]|,\s*details\s*$/.test(args.trim());

  const jets = (): Array<{ fichier: string; ligne: number; classe: string; args: string }> => {
    const vus = new Set<string>();
    const trouves: Array<{ fichier: string; ligne: number; classe: string; args: string }> = [];
    for (const f of racines.flatMap(fichiers)) {
      if (vus.has(f)) continue;
      vus.add(f);
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
    expect(jets().length).toBeGreaterThanOrEqual(150);
  });

  it("aucun refus métier ne part sans code", () => {
    const sansCode = jets()
      .filter((j) => !porteUnCode(j.args) && !/errors|zodErrors|parsed\.error|\.issues|formatZodError/.test(j.args))
      .map((j) => `${j.fichier}:${j.ligne} → ${j.classe}`);
    expect(sansCode).toEqual([]);
  });

  it("aucun 401, 403 ni 404 métier ne part sans code", () => {
    const sansCode = jets()
      .filter((j) => ["AuthError", "ForbiddenError", "NotFoundError"].includes(j.classe) && !porteUnCode(j.args))
      .map((j) => `${j.fichier}:${j.ligne} → ${j.classe}`);
    expect(sansCode).toEqual([]);
  });

  it("les 401 sont distinguables les uns des autres — c'est tout l'intérêt du code", () => {
    const codes = new Set(
      jets()
        .filter((j) => j.classe === "AuthError")
        .map((j) => /code:\s*"([A-Z_]+)"/.exec(j.args)?.[1])
        .filter(Boolean)
    );
    // Un client doit pouvoir réagir différemment à chacun de ces trois-là.
    for (const attendu of ["INVALID_CREDENTIALS", "SESSION_EXPIRED", "ACCOUNT_SUSPENDED"]) {
      expect(codes).toContain(attendu);
    }
  });
});
