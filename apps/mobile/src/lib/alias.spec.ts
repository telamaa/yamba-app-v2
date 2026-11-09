/**
 * alias.spec.ts — la frontière du harnais, vérifiée plutôt qu'espérée (A223).
 * ===========================================================================
 * Le mobile a DEUX programmes TypeScript, et c'est volontaire :
 *   • `tsconfig.json` — celui de Metro. Il ne connaît PAS
 *     `@packages/api-contracts`, donc un écran ne PEUT PAS importer le
 *     contrat : zod ne peut pas entrer dans le bundle par distraction. C'est
 *     la raison pour laquelle `report-form.ts`, `rating-form.ts` et
 *     `pricing-example.ts` RECOPIENT des constantes (A222) ;
 *   • `tsconfig.spec.json` — celui des fiches. Il ajoute l'alias du contrat,
 *     parce que sous Node zod est gratuit, et que comparer la copie à
 *     l'original est justement ce qui rend la recopie tenable.
 *
 * Trois choses peuvent défaire cet équilibre sans bruit : un alias ajouté
 * d'un côté et pas de l'autre (jest ou tsc résout, l'autre non), l'alias du
 * contrat qui fuit dans le programme de l'app, ou un import de zod glissé
 * dans un écran. Les trois sont mesurées ici.
 *
 * Cette fiche LIT les fichiers de configuration du dépôt. C'est assumé : son
 * objet n'est pas une règle métier, c'est la cohérence de l'outillage — et
 * elle coûte moins cher qu'un bundle qui grossit de cent kilo-octets sans
 * que personne ne le remarque.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import jestConfig from '../../jest.config';

const MOBILE_ROOT = resolve(__dirname, '../..');

/** Les tsconfig du dépôt portent des commentaires : `JSON.parse` ne suffit pas. */
function readTsconfig(name: string): { compilerOptions: { paths: Record<string, string[]> } } {
  const raw = readFileSync(join(MOBILE_ROOT, name), 'utf8');
  const withoutComments = raw.replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(withoutComments);
}

const appPaths = readTsconfig('tsconfig.json').compilerOptions.paths;
const specPaths = readTsconfig('tsconfig.spec.json').compilerOptions.paths;
const mapper = (jestConfig as { moduleNameMapper: Record<string, string> }).moduleNameMapper;

/** Les alias `@packages/*` déclarés, sans le joker `@/*` des sources. */
function packageAliases(paths: Record<string, string[]>): string[] {
  return Object.keys(paths).filter((key) => key.startsWith('@packages/')).sort();
}

/** Tous les fichiers de SOURCE de l'app : ni fiche, ni soutien de fiche. */
function appSourceFiles(dir = join(MOBILE_ROOT, 'src')): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'test-support') continue;
      files.push(...appSourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || entry.endsWith('.spec.ts') || entry.endsWith('.d.ts')) continue;
    files.push(full);
  }
  return files;
}

describe('les deux programmes TypeScript et jest voient les mêmes alias', () => {
  it('tout alias `@packages/*` du programme des fiches a son entrée dans jest', () => {
    for (const alias of packageAliases(specPaths)) {
      const pattern = `^${alias}$`;
      expect(Object.keys(mapper)).toContain(pattern);
    }
  });

  it('et réciproquement : jest ne résout rien que tsc ignorerait', () => {
    const fromMapper = Object.keys(mapper)
      .filter((key) => key.includes('@packages'))
      .map((key) => key.replace(/[\^$]/g, '').replace(/\\\//g, '/'))
      .sort();
    expect(fromMapper).toEqual(packageAliases(specPaths));
  });

  it('le joker des sources est le même des deux côtés', () => {
    expect(appPaths['@/*']).toEqual(['./src/*']);
    expect(specPaths['@/*']).toEqual(['./src/*']);
    expect(mapper['^@/(.*)$']).toBe('<rootDir>/src/$1');
  });

  it('tout alias du programme de l’APP existe aussi dans celui des fiches', () => {
    // L'inverse est permis (le contrat n'est QUE pour les fiches), mais une
    // fiche doit pouvoir importer tout ce qu'un écran importe.
    for (const alias of Object.keys(appPaths)) {
      expect(Object.keys(specPaths)).toContain(alias);
    }
  });
});

describe('le contrat Zod reste hors du bundle Metro', () => {
  it('le programme de l’APP ne connaît PAS `@packages/api-contracts`', () => {
    expect(Object.keys(appPaths)).not.toContain('@packages/api-contracts');
  });

  it('…mais garde l’alias de la liste des langues, qui ne tire pas zod (D44)', () => {
    expect(Object.keys(appPaths)).toContain('@packages/api-contracts/locale');
  });

  it('le programme des FICHES, lui, le connaît — c’est tout l’intérêt', () => {
    expect(Object.keys(specPaths)).toContain('@packages/api-contracts');
  });

  it('aucun fichier de source n’importe le contrat ni zod', () => {
    const offenders: string[] = [];
    for (const file of appSourceFiles()) {
      const code = readFileSync(file, 'utf8');
      if (/from\s+['"]@packages\/api-contracts['"]/.test(code)) offenders.push(`${file} (contrat)`);
      if (/from\s+['"]zod['"]/.test(code)) offenders.push(`${file} (zod)`);
    }
    expect(offenders).toEqual([]);
  });

  it('la liste des sources inspectées n’est pas vide — une sonde muette ne prouve rien', () => {
    expect(appSourceFiles().length).toBeGreaterThan(20);
  });
});
