/**
 * recensement.spec.ts — aucun module pur ne reste hors du harnais (A224 lot 5).
 * ==============================================================================
 * La fiche de clôture d'A224, et la plus utile du lot.
 *
 * Le harnais du site est né le 15/11 d'un constat simple : personne n'avait
 * jamais SIGNALÉ l'absence de tests, parce que **ce qui manque ne produit
 * aucun symptôme**. Il a fallu cinq lots consécutifs pour que la dette soit
 * traitée, et elle a été rappelée à l'ouverture de chacun sans jamais l'être.
 *
 * Le même aveuglement guette la suite : on couvre quinze fichiers, on
 * s'arrête, et le seizième arrive sans que rien ne le dise. Cette fiche
 * refuse ce silence — tout module PUR de `src/lib` est soit couvert, soit
 * NOMMÉ ci-dessous avec sa raison.
 *
 * Elle ne mesure pas une couverture de lignes : elle vérifie qu'aucun module
 * n'est OUBLIÉ. Les deux questions sont différentes, et la seconde est celle
 * qui a coûté cinq lots.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const LIB = resolve(__dirname);

/** Un module est « de framework » s'il tire React, Next, axios ou un client. */
const FRAMEWORK = /^import .*(react|next|axios|posthog|@tanstack)/m;

/**
 * Les modules PURS délibérément non couverts, et pourquoi. Ajouter une ligne
 * ici est une DÉCISION — c'est tout l'intérêt de la liste.
 */
const EXCEPTIONS: Record<string, string> = {
  // Chargeurs de scripts externes : ils n'ont pas de règle, ils ont un effet
  // de bord sur le DOM. Les tester reviendrait à tester Google.
  "googleMaps.ts": "charge un script externe — aucun calcul à vérifier",
  "googlePlaces.ts": "charge un script externe — aucun calcul à vérifier",
  // Appels réseau : la règle testable est dans les modules qu'ils appellent.
  "api.ts": "enveloppe de `fetch` — pas de règle propre",
  "api/auth.ts": "appels réseau — pas de règle propre",
  "geocoding/photon.ts": "appel réseau ; sa projection suivra si elle grossit",
  // Mémoire de navigateur : testée à travers ses consommateurs.
  "session-marker.ts": "marqueur de session, lu par l'intercepteur",
  "flash-toast.ts": "file d'attente de messages, sans règle de décision",
  "auth/register-flow-state.ts": "mémoire d'étape, sans règle de décision",
  "auth/hero-visuals.ts": "table d'illustrations, sans règle de décision",
  "current-locale.ts": "lit `window.location` — vérifié par les appelants",
  "legal/versions.ts": "constantes de version, recopiées du paquet partagé",
};

/** Tous les `.ts` de `src/lib`, hors fiches et déclarations. */
function modules(dossier: string = LIB): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return modules(chemin);
    if (!chemin.endsWith(".ts")) return [];
    if (chemin.endsWith(".spec.ts") || chemin.endsWith(".d.ts")) return [];
    return [chemin];
  });
}

/** Ce que les fiches du dossier importent réellement. */
function modulesCouverts(): Set<string> {
  const couverts = new Set<string>();
  for (const fiche of modules(LIB).concat()) void fiche;
  const parcours = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((e) => {
      const p = join(dossier, e);
      if (statSync(p).isDirectory()) return parcours(p);
      return p.endsWith(".spec.ts") ? [p] : [];
    });
  for (const fiche of parcours(LIB)) {
    const source = readFileSync(fiche, "utf8");
    // Les DEUX orthographes de guillemet : la première version de cette
    // fiche ne voyait que les doubles, et déclarait « oubliés » sept modules
    // parfaitement couverts par des fiches écrites avec des simples. On vise
    // l'usage, jamais une orthographe — pour la cinquième fois ce mois-ci.
    for (const m of source.matchAll(/from ['"]@\/lib\/([^'"]+)['"]/g)) {
      couverts.add(`${m[1]}.ts`);
    }
  }
  return couverts;
}

/** Un fichier de TYPES n'a aucune exécution : rien à vérifier. */
function sansExecution(chemin: string): boolean {
  const source = readFileSync(chemin, "utf8");
  return !/^export (function|const|async function)/m.test(source);
}

describe("le recensement lui-même tient debout", () => {
  it("il trouve des modules — sinon il est vert pour rien", () => {
    expect(modules().length).toBeGreaterThanOrEqual(20);
  });

  it("il trouve des fiches qui importent", () => {
    expect(modulesCouverts().size).toBeGreaterThanOrEqual(10);
  });

  it("aucune exception ne nomme un fichier DISPARU", () => {
    // Une exception qui survit à son fichier devient un mensonge silencieux.
    const presents = new Set(modules().map((f) => relative(LIB, f)));
    for (const nom of Object.keys(EXCEPTIONS)) {
      expect(presents.has(nom)).toBe(true);
    }
  });

  it("chaque exception porte une RAISON, pas un simple nom", () => {
    for (const [nom, raison] of Object.entries(EXCEPTIONS)) {
      expect(`${nom}: ${raison}`.length).toBeGreaterThan(nom.length + 20);
    }
  });
});

describe("aucun module PUR ne reste hors du harnais", () => {
  it("tout ce qui porte une règle est couvert, ou nommé", () => {
    const couverts = modulesCouverts();
    const oublies = modules()
      .filter((f) => !FRAMEWORK.test(readFileSync(f, "utf8")))
      .filter((f) => !sansExecution(f))
      .map((f) => relative(LIB, f))
      .filter((rel) => !couverts.has(rel))
      .filter((rel) => !(rel in EXCEPTIONS));

    // Si cette liste n'est pas vide : soit on écrit la fiche, soit on ajoute
    // une ligne à EXCEPTIONS avec sa raison. Les deux sont des décisions ;
    // l'oubli silencieux n'en est pas une.
    expect(oublies).toEqual([]);
  });

  it("les modules de FRAMEWORK sont hors périmètre, et c’est la frontière d’A223", () => {
    // Le harnais n'exécute pas de composant : une règle qu'on veut tester
    // SORT de l'écran. C'est déjà arrivé trois fois — `layout/tunnel.ts`
    // (D93), `search-facets.ts` (D100), `parcel-weight.ts` (D101).
    const avecFramework = modules().filter((f) => FRAMEWORK.test(readFileSync(f, "utf8")));
    for (const f of avecFramework) {
      expect(modulesCouverts().has(relative(LIB, f))).toBe(false);
    }
  });
});
