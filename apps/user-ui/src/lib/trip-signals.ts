/**
 * trip-signals.ts — signaux de popularité d'un trajet (D5 / C-PR6, D60, D100 4A)
 * ==============================================================================
 * Le serveur sert `viewsCount` (vues dédoublonnées par visiteur et par jour). Le front n'en déduit
 * que deux seuils de PRÉSENTATION — jamais une règle métier :
 *
 *   • `MIN_SHOWN_VIEWS` — en dessous, on n'affiche RIEN. D100 4A : le site affichait les vues dès
 *     la première (`viewsCount > 0`), c'est-à-dire « 1 vue » sous un trajet neuf. Publier un
 *     compteur à 1, c'est publier l'impopularité d'une offre — exactement ce que le dépôt avait
 *     déjà écrit pour la capacité restante (« un signal de rareté toujours présent n'est pas un
 *     signal ») sans l'appliquer ici. Le téléphone tenait le bon seuil depuis le début
 *     (`apps/mobile/src/lib/trip-format.ts`, MIN_SHOWN_VIEWS) ; les deux valeurs sont les mêmes,
 *     et une fiche de parité les confronte.
 *   • `POPULAR_VIEWS` — à partir de là, le compte cède la place au badge « Populaire ».
 */
export const POPULAR_VIEWS = 20;
export const MIN_SHOWN_VIEWS = 15;

export const isPopular = (viewsCount: number | null | undefined): boolean =>
  typeof viewsCount === "number" && viewsCount >= POPULAR_VIEWS;

/** Le compteur de vues mérite-t-il d'être montré ? En dessous du seuil, il dessert le trajet. */
export const showsViews = (viewsCount: number | null | undefined): viewsCount is number =>
  typeof viewsCount === "number" && viewsCount >= MIN_SHOWN_VIEWS;
