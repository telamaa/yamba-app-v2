/**
 * trip-signals.ts — signaux de popularité d'un trajet (D5 / C-PR6, D60)
 * ======================================================================
 * Le serveur sert `viewsCount` (vues dédoublonnées par visiteur et par jour). Le front n'en déduit
 * qu'un badge : « Populaire » à partir de POPULAR_VIEWS vues. Seuil de présentation, pas une règle métier.
 */
export const POPULAR_VIEWS = 20;
export const isPopular = (viewsCount: number | null | undefined): boolean => typeof viewsCount === "number" && viewsCount >= POPULAR_VIEWS;
