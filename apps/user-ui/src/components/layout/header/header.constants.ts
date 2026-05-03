// apps/user-ui/src/components/layout/header/header.constants.ts

/**
 * Tokens partagés du Header.
 * Source unique pour les couleurs et seuils utilisés dans tous les sous-composants.
 */
export const HEADER_COLORS = {
  mango: "#FF9900",
  mangoTint: "#FFF6E8",
  teal: "#0F766E",
  tealDark: "#2DD4BF",
  danger: "#EF4444",
} as const;

/** Hauteur fixe du Header (matche `pt-[78px]` du layout). */
export const HEADER_HEIGHT_PX = 78;

/** Seuil scroll en px à partir duquel le header passe en mode compact. */
export const HEADER_COMPACT_SCROLL_THRESHOLD = 8;

/** Z-index du header et de ses overlays. */
export const HEADER_Z_INDEX = 100;
