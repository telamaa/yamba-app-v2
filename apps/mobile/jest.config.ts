/**
 * jest.config.ts — le harnais de tests de l'application mobile (A223).
 * ====================================================================
 * Ce que ce harnais exécute, et ce qu'il n'exécute PAS.
 *
 * IL EXÉCUTE la logique PURE de `src/lib/` : les règles, les validations, les
 * mises en forme, les brouillons en mémoire de processus. Deux mille lignes
 * écrites sans React ni react-native exprès pour ça (A205, A213, A217, A221,
 * A222 l'ont toutes consigné comme axe) — et qu'aucun des dix-huit contrôles
 * de la CI ne voyait.
 *
 * IL N'EXÉCUTE PAS les écrans. Rendre un composant react-native demanderait
 * `jest-expo` (preset Babel + `react-test-renderer`), donc trois dépendances
 * de plus pour un poste déjà contraint, et un bundle de test qui n'a rien à
 * voir avec ce que Metro produit. Le choix est celui de la frontière : la
 * logique sort de l'écran, l'écran n'est qu'un affichage. Le jour où un écran
 * portera une règle qu'on veut tester, c'est la règle qu'il faudra sortir —
 * pas le harnais qu'il faudra grossir.
 *
 * Conséquence : `testEnvironment: "node"`, aucune dépendance nouvelle
 * (`jest@30`, `ts-jest`, `@types/jest` sont déjà à la racine du dépôt).
 *
 * La résolution est DÉCLARÉE ici et dans `tsconfig.spec.json`, pas héritée du
 * `tsconfig.json` de l'app : celui-là est écrit pour Metro (`module: preserve`,
 * `moduleResolution: bundler`, conditions `react-native`), que ts-jest ne sait
 * pas émettre. Les deux fichiers doivent donc rester alignés sur leurs alias —
 * `alias.spec.ts` le VÉRIFIE, plutôt que de l'espérer.
 */
export default {
  displayName: '@yamba-app/mobile',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Les alias du `tsconfig.spec.json`, en version jest. `@packages/api-contracts`
  // n'existe QUE pour les fiches : l'app ne doit pas tirer zod dans son bundle
  // Metro, et c'est justement pour cela que ses modules RECOPIENT les
  // constantes du contrat — ce que les fiches peuvent enfin comparer.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@packages/api-contracts$': '<rootDir>/../../packages/libs/api-contracts/src/index.ts',
    '^@packages/api-contracts/locale$': '<rootDir>/../../packages/libs/api-contracts/src/locale.ts',
    '^@packages/pricing$': '<rootDir>/../../packages/libs/pricing/src/index.ts',
    '^@packages/legal/versions$': '<rootDir>/../../packages/libs/legal/versions.ts',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: '../../coverage/apps/mobile',
};
