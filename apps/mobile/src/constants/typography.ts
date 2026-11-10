/**
 * typography.ts — la police de la marque sur le téléphone (D95).
 * ===============================================================
 * Le site compose en **Plus Jakarta Sans** (`apps/user-ui/src/app/layout.tsx`,
 * `global.css`) ; le téléphone composait avec la police SYSTÈME — SF Pro sur
 * iOS, Roboto sur Android. Deux produits, deux typographies, pour le même
 * compte.
 *
 * Ce n'était pas qu'une question de goût. À graisse NUMÉRIQUE égale, SF Pro
 * rend plus épais que Plus Jakarta : c'est pourquoi l'écran d'inscription du
 * téléphone paraissait « trop gras » alors que ses nombres étaient DÉJÀ ceux
 * du site. On pouvait baisser les graisses indéfiniment sans jamais rejoindre
 * le site — on rapprochait une courbe d'une autre au lieu de changer de
 * courbe.
 *
 * POURQUOI UNE FAMILLE PAR GRAISSE, et pas `fontWeight` :
 * `expo-font` ne sait regrouper plusieurs fichiers sous une seule famille avec
 * des descripteurs de graisse que par son CONFIG PLUGIN — donc dans un build
 * de développement, que ce chantier n'utilise pas (il tourne sous Expo Go,
 * D82 3A). Au runtime, chaque graisse est une famille à part entière, et c'est
 * son NOM qui la désigne. Vérifié dans la documentation du SDK 57 avant
 * d'écrire une ligne, parce que supposer l'inverse aurait donné des faux gras
 * de synthèse sur Android sans rien casser de visible en développement.
 *
 * CONSÉQUENCE À CONNAÎTRE : un `fontWeight` laissé à côté d'un `fontFamily`
 * nommé déclenche un GRAS DE SYNTHÈSE sur Android (le système épaissit un
 * dessin déjà épais). Les deux ne cohabitent donc jamais — une fiche compte
 * les `fontWeight` restants dans `src/`, et le nombre attendu est zéro.
 */
// Import par SOUS-CHEMIN, pas par le baril du paquet. Deux raisons :
//   • le baril réexporte les QUATORZE graisses (plus leurs italiques) et son
//     propre `useFonts` : s'en servir embarquerait tout, pour cinq fichiers
//     utiles ;
//   • ce même baril tire `expo-font` par une chaîne d'ESM que le harnais ne
//     sait pas traverser — et une fiche qui ne peut pas importer la règle ne
//     la vérifie pas.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

/**
 * Les quatre niveaux de lecture de D91 5A, plus l'extra-gras réservé aux
 * glyphes dessinés (une croix de fermeture, une coche de case) — leur graisse
 * est un trait, pas un niveau.
 */
export const Font = {
  /** Corps de texte : tout ce qui se lit en phrases. */
  regular: 'PlusJakartaSans_400Regular',
  /** Libellés, liens, mentions : ce qui nomme sans réclamer. */
  medium: 'PlusJakartaSans_500Medium',
  /** Titres d'écran, valeurs qu'on repère (un compte à rebours, un prix). */
  semibold: 'PlusJakartaSans_600SemiBold',
  /** Le bouton. UN SEUL élément par écran (D91 5A). */
  bold: 'PlusJakartaSans_700Bold',
  /** Glyphes dessinés uniquement. */
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontName = (typeof Font)[keyof typeof Font];

/**
 * Ce que `useFonts` attend : le nom de famille → le fichier.
 *
 * Les clés sont EXACTEMENT les valeurs de `Font` ci-dessus. C'est le seul
 * lien entre les deux, et une faute de frappe y serait invisible — React
 * Native ne se plaint pas d'une famille inconnue, il retombe sur la police
 * système. Une fiche confronte donc les deux listes.
 */
export const FONT_ASSETS = {
  [Font.regular]: PlusJakartaSans_400Regular,
  [Font.medium]: PlusJakartaSans_500Medium,
  [Font.semibold]: PlusJakartaSans_600SemiBold,
  [Font.bold]: PlusJakartaSans_700Bold,
  [Font.extrabold]: PlusJakartaSans_800ExtraBold,
} as const;

/**
 * `600` → `PlusJakartaSans_600SemiBold`.
 *
 * Utile aux rares endroits où la graisse est CALCULÉE (un libellé qui
 * s'épaissit quand il est sélectionné). Partout ailleurs, on nomme le niveau
 * directement : `Font.medium` se lit, `fontFor(500)` se déchiffre.
 */
export function fontFor(weight: 400 | 500 | 600 | 700 | 800): FontName {
  switch (weight) {
    case 400:
      return Font.regular;
    case 500:
      return Font.medium;
    case 600:
      return Font.semibold;
    case 700:
      return Font.bold;
    case 800:
      return Font.extrabold;
  }
}
