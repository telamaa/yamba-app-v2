/**
 * back-affordance.ts — les mesures du retour (D105).
 * ====================================================
 * Zéro import, et c'est la raison d'être du fichier : `components/back-button.tsx`
 * tire `react-native` et `@expo/vector-icons`, que le harnais ne sait pas
 * analyser (`testEnvironment: node`, A223). Une fiche ne peut donc pas lire
 * ses constantes depuis là.
 *
 * C'est la DEUXIÈME fois dans la même journée que cette frontière se paie —
 * D102 l'avait rencontrée sur `lib/api/search.api.ts`, qui remonte à
 * `expo-constants`. La leçon tenait déjà au chapitre 242 : quand une fiche
 * refuse de charger votre code, elle vous apprend où passe la frontière ;
 * déplacez le code, pas la frontière. Il a fallu l'apprendre deux fois.
 */

/** La taille retenue : entre les 20 px des écrans de paiement et les 26 px
 *  des écrans de recherche. Une seule valeur, nommée une fois. */
export const BACK_ICON_SIZE = 22;

/** 12 pt autour : avec l'icône, la cible tactile atteint les 44 pt du système. */
export const BACK_HIT_SLOP = 12;

/** Le disque de la variante `boxed`, tel que quatre écrans le dessinaient déjà. */
export const BACK_BOX_SIZE = 36;
