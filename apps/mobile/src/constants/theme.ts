/**
 * Jetons de thème du client mobile — même système que le web (mangue + teal,
 * clair/sombre). Les couleurs de marque sont celles du design system
 * (`apps/user-ui`) : mangue #FF9900, teal #0F766E.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { barHeight } from '@/lib/tab-bar-geometry';

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
   * Hauteur de la barre — 60 depuis D109.
   *
   * Elle ne se déduit plus d'une pilule mais d'un EMPILEMENT, et chaque
   * terme a sa raison :
   *
   *     indicateur 32  (l'icône de 22, centrée, 5 de chaque côté)
   *   + écart        4
   *   + ligne du mot 14  (10 pt × 1,4 — au-dessus du plancher maison de 1,35)
   *   ─────────────────
   *     contenu      50, plus 5 de respiration de chaque côté → 60
   *
   * Les 52 précédents venaient d'un indicateur de 42 qui CONTENAIT le mot :
   * il ne restait que 11 pt de fente, donc 9 pt de police — sous le minimum
   * d'iOS (10) comme de Material 3 (11). L'indicateur étant passé derrière
   * la seule icône (D109 1B), le texte a retrouvé sa place.
   */
  height: barHeight(),
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
