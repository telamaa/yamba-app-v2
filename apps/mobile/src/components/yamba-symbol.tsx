/**
 * yamba-symbol.tsx — le symbole Yamba (logo « Porter ») dans l'application.
 * ==========================================================================
 * Un Y tracé d'un seul trait dont les bras portent un colis (D85).
 *
 * POURQUOI `expo-image` ET NON `react-native-svg`. Le dépôt n'a pas
 * `react-native-svg` et ce symbole ne justifie pas de l'ajouter : `expo-image`
 * rend déjà du SVG (l'illustration de l'écran d'accueil passe par lui depuis
 * A205). Zéro dépendance nouvelle, et le fichier est le MÊME que celui servi
 * par le site — une seule source de vérité pour le dessin.
 *
 * POURQUOI DEUX FICHIERS. Une image ne reçoit pas les styles de l'écran : là
 * où le web change la couleur du colis par une classe `dark:`, ici il faut
 * deux fichiers et choisir. Le choix se fait sur le fond RÉSOLU, jamais sur
 * une supposition.
 *
 * Le mot « Yamba » n'est PAS dedans : il reste du texte (D85 2A), donc net à
 * toute taille, lu par VoiceOver et TalkBack, et traduisible.
 */
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

/** Le ratio du symbole : 192 de large pour 200 de haut. Jamais deviné. */
const RATIO = 200 / 192;

const SOURCES = {
  light: require('../../assets/images/yamba-symbol.svg'),
  dark: require('../../assets/images/yamba-symbol-dark.svg'),
  white: require('../../assets/images/yamba-symbol-white.svg'),
} as const;

type Props = {
  /** Largeur en px. La hauteur suit le ratio. */
  size?: number;
  /**
   * Le fond sur lequel le symbole est posé.
   *
   *   • `light` / `dark` : Y mango ; seul le COLIS change — teal foncé sur
   *     clair, turquoise sur sombre, sans quoi il se perdrait dans le fond ;
   *   • `white` : sur un fond MANGO (l'écran de démarrage) — Y blanc, colis
   *     teal, parce qu'un Y mango sur du mango n'existe pas.
   *
   * Le web a une variante `auto` qui suit le thème par une classe CSS. Ici,
   * une image ne reçoit pas les styles de l'écran : la variante est donc
   * TOUJOURS explicite, et c'est l'appelant qui connaît son fond.
   */
  variant?: keyof typeof SOURCES;
  /** Texte accessible. Sans lui, le symbole est décoratif. */
  label?: string;
  style?: StyleProp<ImageStyle>;
};

export default function YambaSymbol({ size = 32, variant = 'light', label, style }: Props) {
  return (
    <Image
      source={SOURCES[variant]}
      style={[{ width: size, height: Math.round(size * RATIO) }, style]}
      contentFit="contain"
      accessible={label !== undefined}
      accessibilityRole={label !== undefined ? 'image' : undefined}
      accessibilityLabel={label}
      // Un logo ne se charge pas « en fondu » : il est là, ou il n'est pas.
      transition={0}
    />
  );
}
