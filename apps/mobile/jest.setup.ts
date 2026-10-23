/**
 * jest.setup.ts — le peu de runtime react-native dont la logique pure dépend.
 * ===========================================================================
 * `__DEV__` est un global que Metro INJECTE dans tous les bundles : il vaut
 * `true` en développement, `false` dans un build publié. Sous Node, il
 * n'existe pas — et `stripe-sheet.ts` le lit pour choisir l'environnement de
 * Google Pay (D82 1A : l'environnement est une configuration, jamais une
 * déduction du préfixe de clé). Sans cette ligne, sa lecture lèverait une
 * `ReferenceError` qui serait avalée par le `try` du fichier et travestie en
 * « indisponible » : le test passerait en mesurant autre chose que la règle.
 *
 * On le pose à `false` — l'état d'un build PUBLIÉ, c'est-à-dire le cas où une
 * erreur coûte de l'argent réel. Les fiches qui testent l'autre branche le
 * surchargent explicitement.
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
