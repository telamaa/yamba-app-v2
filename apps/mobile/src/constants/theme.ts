/**
 * Jetons de thème du client mobile — même système que le web (mangue + teal,
 * clair/sombre). Les couleurs de marque sont celles du design system
 * (`apps/user-ui`) : mangue #FF9900, teal #0F766E.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Brand = {
  mango: '#FF9900',
  /** Mangue assombrie pour l'état actif sur fond clair — la valeur de la
   *  barre mobile du web (`DashboardMobileNav`, #CC7A00) : le #FF9900 pur
   *  manque de contraste sur blanc. */
  mangoDark: '#CC7A00',
  teal: '#0F766E',
} as const;

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // Teinte d'accent (liens, éléments actifs) : teal lisible sur fond clair…
    tint: Brand.teal,
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // …et teal éclairci sur fond sombre (le #0F766E y est illisible).
    tint: '#2DD4BF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * La barre d'onglets DESSINÉE (D88) — ses deux mesures, en un seul endroit.
 * La barre n'est plus celle de l'OS : c'est une pilule flottante, et sa
 * géométrie est lue à la fois par la barre elle-même et par ce que les
 * écrans réservent en bas.
 */
export const TabBar = {
  /**
   * Hauteur de la barre. 52 et non 56 : l'indicateur de sélection fait 42
   * (`PILL_HEIGHT` dans `components/tab-bar.tsx`), il lui reste donc 5 de
   * chaque côté. La référence de composition est aussi serrée — 38 dans 45
   * chez YouTube, mesuré sur la capture du 08/11 — et c'est cette étroitesse
   * qui fait lire l'indicateur comme un bandeau plutôt que comme un bouton
   * perdu au milieu d'une barre.
   */
  height: 52,
  /** Son écart au bas de la zone sûre : c'est ce vide qui la fait FLOTTER. */
  gap: Spacing.two,
} as const;

/**
 * Ce qu'un contenu défilant réserve en bas pour que la barre flotte sans
 * masquer sa dernière carte.
 *
 * La zone sûre varie d'un appareil à l'autre (34 pt sous un iPhone à encoche,
 * 0 sur un SE) et une constante ne la connaît pas : on prend le cas le plus
 * haut. Du vide en fin de liste ne coûte rien ; une carte coincée sous la
 * barre coûte un geste à chaque fois.
 */
export const BottomTabInset =
  TabBar.height + TabBar.gap + (Platform.select({ ios: 34, android: 24 }) ?? 0);
export const MaxContentWidth = 800;
