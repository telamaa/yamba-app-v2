/**
 * jest.config.ts — le harnais de tests du site (A224).
 * ====================================================
 * Ce que ce harnais exécute, et ce qu'il n'exécute PAS.
 *
 * IL EXÉCUTE la logique PURE de `src/lib/` : les règles, les mises en forme,
 * les projections de prix, les régimes de navigation. **35 fichiers, ~2 900
 * lignes** écrits sans React ni Next exprès pour cela — et qu'aucun des
 * dix-neuf contrôles de la CI ne voyait, sur la plus grosse application du
 * dépôt. C'est mot pour mot le constat d'A223 pour le mobile, qui avait
 * 2 109 lignes dans le même cas.
 *
 * IL N'EXÉCUTE PAS les composants. Rendre du React demanderait
 * `@testing-library/react` + `jsdom`, donc des dépendances de plus sur un
 * poste déjà contraint, et un environnement qui n'a rien à voir avec ce que
 * Next produit. Le choix est celui de la FRONTIÈRE, pas celui de l'ambition :
 * le jour où un composant portera une règle qu'on veut tester, c'est la règle
 * qu'il faudra sortir — pas le harnais qu'il faudra grossir. C'est déjà
 * arrivé trois fois, et chaque fois pour le mieux : `lib/layout/tunnel.ts`
 * (D93), `lib/search-facets.ts` (D100 5A), `lib/parcel-weight.ts` (D101 2B).
 *
 * Conséquence : `testEnvironment: "node"`, **zéro dépendance nouvelle**
 * (`jest@30`, `ts-jest` et `@types/jest` sont déjà à la racine du dépôt, et
 * `@nx/jest/plugin` est déjà déclaré dans `nx.json` — poser ce fichier suffit
 * à faire apparaître la cible `test`).
 *
 * La résolution est DÉCLARÉE ici et dans `tsconfig.spec.json`, pas héritée du
 * `tsconfig.json` de l'application : celui-là est écrit pour Next
 * (`moduleResolution: bundler`, `jsx: preserve`, `noEmit`), que ts-jest ne
 * sait pas émettre. Les deux fichiers doivent donc rester alignés sur leurs
 * alias — `alias.spec.ts` le VÉRIFIE, plutôt que de l'espérer (A223).
 */
export default {
  displayName: '@yamba-app/user-ui',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@packages/pricing$': '<rootDir>/../../packages/libs/pricing/src/index.ts',
    '^@packages/api-contracts/locale$':
      '<rootDir>/../../packages/libs/api-contracts/src/locale.ts',
    // Le contrat COMPLET, pour les fiches seulement (D115 bis) : l'ordre des
    // deux lignes compte, jest prend la PREMIÈRE qui correspond.
    '^@packages/api-contracts$': '<rootDir>/../../packages/libs/api-contracts/src/index.ts',
    '^@packages/libs/maintenance$': '<rootDir>/../../packages/libs/maintenance/index.ts',
  },
  coverageDirectory: '../../coverage/apps/user-ui',
};
