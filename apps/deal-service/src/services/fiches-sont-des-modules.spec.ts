import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * fiches-sont-des-modules.spec.ts — aucune fiche de test ne doit être un SCRIPT
 * ==============================================================================
 * Piège consigné le 17/09, enseigné au chapitre 188, et pourtant encore vivant dans quatre fichiers
 * le 18/09 : **une fiche qui n'a ni `import` ni `export` de tête est un SCRIPT pour TypeScript**. Ses
 * constantes ne sont pas locales au fichier : elles tombent dans la portée globale partagée par tout
 * le programme, où elles se heurtent à celles des fiches voisines.
 *
 *     const prismaMock = { … };   // dans deux fiches-scripts → TS2451 « Cannot redeclare »
 *
 * Deux choses rendent ce défaut particulièrement désagréable :
 *
 *   1. l'erreur est rapportée sur le fichier **VOISIN**, pas sur celui qu'on vient d'ajouter ;
 *   2. `nx test` ne le voit pas du tout — Jest isole les modules, le typage ne le concerne pas.
 *
 * Remède : `export {};` en pied, qui suffit à en refaire un module.
 *
 * ── Pourquoi cette fiche EN PLUS du check CI « TypeScript (fiches de test) » ────────────────────
 *
 * Le check CI ajouté le 18/09 fait tourner `nx typecheck`, qui VOIT les fiches — c'est lui qui aurait
 * attrapé les 53 erreurs de ce jour-là. Mais il attrape le **symptôme**, pas la **cause** : mesuré, une
 * fiche-script SEULE ne déclenche rien (aucune collision), il en faut DEUX qui déclarent un même nom.
 * Autrement dit, la première fiche fautive passe, et c'est la suivante — écrite par quelqu'un d'autre,
 * des semaines plus tard — qui fait tomber la CI, sur un troisième fichier encore.
 *
 * Ce balayage attrape la cause dès la première fiche. Il coûte une seconde, et — c'est ce qui le rend
 * soutenable — il n'a **aucune liste d'exceptions à maintenir** : la règle est vraie pour toute fiche,
 * sans dérogation possible. (À comparer avec la piste « clé i18n orpheline » du 18/09, qui en
 * exigerait une pour les clés composées à l'exécution : une liste d'exceptions qui grossit est un
 * contrôle qui meurt.)
 */

/** Toutes les fiches de test versionnées des applications ET des paquets partagés. */
function fichesDeTest(): Array<{ chemin: string; code: string }> {
  const racine = join(__dirname, "../../../..");
  const trouvees: Array<{ chemin: string; code: string }> = [];

  const parcourir = (dossier: string) => {
    let entrees: string[];
    try {
      entrees = readdirSync(dossier);
    } catch {
      return;
    }
    for (const entree of entrees) {
      const complet = join(dossier, entree);
      if (statSync(complet).isDirectory()) {
        if (entree === "node_modules" || entree === "dist" || entree === ".next" || entree === "out-tsc") continue;
        parcourir(complet);
        continue;
      }
      if (!entree.endsWith(".spec.ts") && !entree.endsWith(".test.ts")) continue;
      trouvees.push({ chemin: complet.slice(racine.length + 1), code: readFileSync(complet, "utf-8") });
    }
  };

  parcourir(join(racine, "apps"));
  parcourir(join(racine, "packages"));
  return trouvees;
}

/** Un `import` ou un `export` en tête de ligne suffit à faire du fichier un MODULE. */
const EST_UN_MODULE = /^\s*(import|export)\s/m;

const fiches = fichesDeTest();

describe("toute fiche de test est un MODULE, jamais un script", () => {
  it("l'inventaire n'est pas vide (sinon cette fiche ne prouverait rien)", () => {
    expect(fiches.length).toBeGreaterThan(100);
  });

  it("aucune fiche sans `import` ni `export` — sinon ses constantes fuient dans la portée globale", () => {
    const scripts = fiches.filter((f) => !EST_UN_MODULE.test(f.code)).map((f) => f.chemin);
    expect(scripts).toEqual([]);
  });

  it("la règle attrape bien ce qu'elle prétend interdire (vue ROUGE)", () => {
    const script = `const prismaMock = { user: {} };\ndescribe("x", () => { it("y", () => { expect(prismaMock).toBeDefined(); }); });\n`;
    expect(EST_UN_MODULE.test(script)).toBe(false); // ← fiche fautive détectée

    // Les trois formes qui en font un module sont toutes acceptées.
    expect(EST_UN_MODULE.test(`import x from "y";\n${script}`)).toBe(true);
    expect(EST_UN_MODULE.test(`${script}export {};\n`)).toBe(true);
    expect(EST_UN_MODULE.test(`export const util = 1;\n${script}`)).toBe(true);
  });

  it("un `import` en COMMENTAIRE ou dans une chaîne ne compte pas pour un module", () => {
    // La règle exige l'instruction en tête de ligne : un `import` cité dans un commentaire de bloc
    // (« le piège : une fiche sans import… ») ne doit pas faire passer une fiche-script pour un module.
    expect(EST_UN_MODULE.test(` * une fiche sans import ni export est un script\nconst x = 1;\n`)).toBe(false);
    expect(EST_UN_MODULE.test(`const s = "import x";\n`)).toBe(false);
  });
});
