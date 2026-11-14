/**
 * alias.spec.ts — le harnais résout ce que l'application résout (A224).
 * =====================================================================
 * Le site a DEUX programmes TypeScript : `tsconfig.json`, écrit pour Next
 * (`moduleResolution: bundler`, `jsx: preserve`), et `tsconfig.spec.json`,
 * écrit pour ts-jest (`commonjs`, `node10`). Les alias y sont donc DÉCLARÉS
 * deux fois — et une troisième dans `jest.config.ts`, en version jest.
 *
 * Trois copies de la même table de résolution : exactement la forme de
 * divergence que ce dépôt a payée cinq fois (`maskEmail` D92, la lecture des
 * refus D96, la liste des pages d'auth D93, la mise en forme d'un prix D99,
 * la liste des familles D102). Cette fiche la rend impossible : un alias
 * ajouté d'un côté et oublié des deux autres part au rouge.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP = resolve(__dirname, '../..');

/** Lit un JSON avec commentaires (les tsconfig du dépôt en portent). */
function litJsonc(chemin: string): Record<string, unknown> {
  const brut = readFileSync(chemin, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(brut);
}

function pathsDe(fichier: string): string[] {
  const d = litJsonc(join(APP, fichier)) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  return Object.keys(d.compilerOptions?.paths ?? {}).sort();
}

describe('les alias du harnais suivent ceux de l’application', () => {
  it('tout alias `@packages/*` de l’application existe aussi pour les fiches', () => {
    // Le sens qui compte : un module que l'APPLICATION sait importer doit être
    // importable par une fiche. L'inverse est permis (le harnais peut déclarer
    // davantage, comme le mobile le fait pour `@packages/api-contracts`).
    const app = pathsDe('tsconfig.json').filter((a) => a.startsWith('@packages/'));
    const fiches = pathsDe('tsconfig.spec.json');
    for (const alias of app) {
      expect(fiches).toContain(alias);
    }
  });

  it('`@/*` pointe sur `src` des deux côtés', () => {
    for (const fichier of ['tsconfig.json', 'tsconfig.spec.json']) {
      const d = litJsonc(join(APP, fichier)) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };
      const cible = d.compilerOptions?.paths?.['@/*']?.[0] ?? '';
      expect(cible.replace('./', '')).toBe('src/*');
    }
  });

  it('jest connaît les mêmes alias que `tsconfig.spec.json`', () => {
    // Troisième copie : ts-jest type, mais c'est JEST qui résout à l'exécution.
    // Un alias absent d'ici donne « Cannot find module » au premier import.
    const config = readFileSync(join(APP, 'jest.config.ts'), 'utf8');
    for (const alias of pathsDe('tsconfig.spec.json')) {
      const motif = alias.replace('/*', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(config).toMatch(new RegExp(motif));
    }
  });
});

describe('le harnais ne prétend pas rendre des composants', () => {
  it('il tourne dans `node`, et c’est une frontière assumée', () => {
    const config = readFileSync(join(APP, 'jest.config.ts'), 'utf8');
    expect(config).toContain("testEnvironment: 'node'");
  });

  it('aucune dépendance de rendu n’est entrée dans le dépôt', () => {
    // On vise l'USAGE, jamais le mot : la première version de cette fiche
    // interdisait la chaîne « jsdom » dans `jest.config.ts` — et partait au
    // rouge sur le COMMENTAIRE qui explique pourquoi jsdom n'y est pas. Un
    // fichier bien écrit explique ce qu'il a cessé de faire (leçon payée
    // trois fois en novembre : D98, D99, D100). On regarde donc ce qui est
    // réellement INSTALLÉ : si l'un de ces paquets entre, c'est que la
    // frontière d'A224 2A a bougé — une DÉCISION, pas un détail.
    const racine = JSON.parse(
      readFileSync(resolve(APP, '../..', 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const installes = Object.keys({ ...racine.dependencies, ...racine.devDependencies });
    expect(installes.filter((p) => p.includes('jsdom'))).toEqual([]);
    expect(installes.filter((p) => p.startsWith('@testing-library/'))).toEqual([]);
  });
});
