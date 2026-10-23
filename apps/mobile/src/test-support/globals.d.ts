/**
 * globals.d.ts — les globals de Metro, pour le programme des fiches.
 * ==================================================================
 * Le `tsconfig.json` de l'app reçoit `__DEV__` par les types d'Expo
 * (`expo-env.d.ts` → `expo/types`). Le programme des fiches, lui, part de
 * `tsconfig.base.json` et ne charge que `jest` et `node` : il faut donc le
 * redéclarer ici, à l'identique.
 */
declare const __DEV__: boolean;
