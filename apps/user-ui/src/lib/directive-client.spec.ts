/**
 * directive-client.spec.ts — rien avant `"use client"` (28/11/2026).
 * ====================================================================
 * Il n'y a pas de module ici : la règle à garder n'est pas une fonction,
 * c'est une CONTRAINTE DE FICHIER.
 *
 * ── CE QUI EST ARRIVÉ ───────────────────────────────────────────────────
 * D110 a réécrit une cinquantaine de fichiers pour leur faire importer
 * `conteneurDePage`. Dans DEUX squelettes, l'import a atterri **au-dessus**
 * de la directive `"use client"` — ce que Next refuse :
 *
 *     The "use client" directive must be placed before other expressions.
 *
 * `next build` échouait donc depuis le 21/11, et **aucun des vingt contrôles
 * de la CI ne l'a vu** : ils lancent `tsc` et `jest`, jamais `next build`
 * (le job « la CI construit ce qu'elle déploie » est un candidat depuis des
 * mois). Le defaut a été trouvé par le HARNAIS NAVIGATEUR, qui n'est pas non
 * plus un contrôle de CI, et qui n'avait pas été rejoué depuis une semaine :
 * la page de suivi de l'Expéditeur affichait l'écran d'erreur de Next.
 *
 * **Deux filets absents se croisent, et une semaine passe.** Cette fiche est
 * le filet le moins cher des trois : elle ne remplace pas `next build`, elle
 * attrape cette classe-là en une seconde.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(__dirname, "..", "..");
const ADMIN = resolve(SITE, "../admin-ui/src");

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    if (!/\.(ts|tsx)$/.test(chemin)) return [];
    if (/\.(spec|d)\.ts$/.test(chemin)) return [];
    return [chemin];
  });
}

/** Ce qui précède la directive, commentaires et blancs retirés. */
function codeAvantLaDirective(source: string): string | null {
  const i = Math.max(source.indexOf('"use client"'), source.indexOf("'use client'"));
  if (i === -1) return null;
  return source
    .slice(0, i)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

describe('rien ne précède `"use client"`', () => {
  it("sur les DEUX fronts, la directive est la première expression du fichier", () => {
    const fautifs: string[] = [];
    let directives = 0;

    for (const racine of [join(SITE, "src"), ADMIN]) {
      for (const fichier of sources(racine)) {
        const avant = codeAvantLaDirective(readFileSync(fichier, "utf8"));
        if (avant === null) continue;
        directives += 1;
        // Un commentaire d'en-tête est permis — c'est la convention de ce
        // dépôt, et Next l'accepte. Une EXPRESSION, non.
        if (avant.length > 0) {
          fautifs.push(`${fichier.split("/src/")[1]} → ${avant.split("\n")[0].slice(0, 60)}`);
        }
      }
    }

    // Un balayage qui ne balaie rien serait vert pour la pire raison.
    expect(directives).toBeGreaterThan(50);
    expect(`fautifs → ${fautifs.join(" | ") || "aucun"}`).toBe("fautifs → aucun");
  });
});
