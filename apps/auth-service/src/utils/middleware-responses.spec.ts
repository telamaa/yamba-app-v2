import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Dette D-5 du rapport de recette API (08/09/2026) — « les middlewares écrivent leur réponse
 * eux-mêmes, hors du middleware d'erreur ». Conséquence : trois formes de corps d'erreur
 * coexistaient sur la plateforme (`{message, code}`, `{success: false, message}` et le
 * `{status: "error", message, details}` du middleware commun), et un client ne pouvait pas écrire
 * UNE fonction pour les lire.
 *
 * Un refus qui court-circuite le middleware d'erreur, c'est aussi : pas de décision centrale sur ce
 * qui est exposé en production, et pas de remontée Sentry. Ce test l'interdit dans
 * `packages/middleware`.
 *
 * Ce qui reste autorisé, et pourquoi :
 * - les réponses de SUCCÈS (2xx) — ce ne sont pas des erreurs ;
 * - `packages/error-handler` lui-même, qui EST le middleware d'erreur.
 */
describe("middlewares partagés — aucun refus n'écrit sa réponse lui-même (D-5)", () => {
  // Les middlewares partagés vivent hors du projet jest : on remonte à la racine du dépôt.
  const racine = join(__dirname, "../../../../packages/middleware");

  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return fichiers(p);
      return p.endsWith(".ts") && !p.endsWith(".spec.ts") ? [p] : [];
    });

  it("le test lit bien les middlewares (garde-fou du garde-fou)", () => {
    const noms = fichiers(racine).map((f) => f.split("/").pop());
    expect(noms).toEqual(expect.arrayContaining(["isAuthenticated.ts", "isAdminAuthenticated.ts", "requireAdminRole.ts"]));
  });

  it("aucun `res.status(4xx|5xx).json(...)` : les refus passent par `next()`", () => {
    const fautifs: string[] = [];
    for (const f of fichiers(racine)) {
      const code = readFileSync(f, "utf-8");
      for (const m of code.matchAll(/res\s*\.?\s*\n?\s*\.?status\(\s*([45]\d\d)\s*\)/g)) {
        fautifs.push(`${f.split("/").pop()}:${code.slice(0, m.index).split("\n").length} → ${m[1]}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("chaque refus porte un code — la règle générale, vérifiée ici aussi", () => {
    const sansCode: string[] = [];
    for (const f of fichiers(racine)) {
      const code = readFileSync(f, "utf-8");
      for (const m of code.matchAll(/new (ValidationError|ForbiddenError|NotFoundError|ConflictError|AuthError)\(/g)) {
        let i = m.index! + m[0].length;
        let profondeur = 1;
        while (i < code.length && profondeur > 0) {
          if (code[i] === "(") profondeur++;
          else if (code[i] === ")") profondeur--;
          i++;
        }
        const args = code.slice(m.index! + m[0].length, i - 1);
        if (!/(^|[\s,{])code\s*[,:}]/.test(args)) {
          sansCode.push(`${f.split("/").pop()}:${code.slice(0, m.index).split("\n").length} → ${m[1]}`);
        }
      }
    }
    expect(sansCode).toEqual([]);
  });
});
