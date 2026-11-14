/**
 * parcel-weight.ts — le colis de l'Expéditeur : bornes, pas, valeurs d'usage.
 * ===========================================================================
 * D101 2B — ces nombres vivaient en dur dans le JSX du site
 * (`min={0.5} max={30} step={0.5}`). Deux fronts ne peuvent pas s'accorder sur
 * des nombres qu'aucun des deux ne nomme : le téléphone, lui, n'en avait
 * AUCUN, faute de contrôle.
 *
 * ⚠️ Ce fichier est DUPLIQUÉ à l'identique dans `apps/user-ui/src/lib/` et une
 * fiche compare les deux copies À L'OCTET PRÈS — même dispositif que
 * `pricing-example.ts` (D99) et `search-facets.ts` (D100 5A), pour la même
 * raison : un `import` par-dessus la frontière d'un projet est une dépendance
 * de BUILD (D93), et le site n'a pas de harnais pour se garder lui-même.
 *
 * Le GESTE, lui, n'est pas partagé — et c'est voulu (D101 2A, précédent A207
 * du calendrier) : le site fait glisser un curseur, geste de souris, précis au
 * pixel ; le téléphone avance pas à pas et propose des valeurs d'usage, parce
 * que viser l'un de 59 crans sur une piste large d'un écran revient à ~8 px
 * par cran, et que l'Expéditeur VISE un poids qu'il connaît plutôt qu'il n'en
 * explore le continuum. Mêmes nombres, mode de parcours natif.
 */

/** Le plus petit colis réglable. En dessous, c'est le plancher de facturation
 *  (D81) qui décide du prix, pas le curseur. */
export const MIN_PARCEL_KG = 0.5;

/** Au-delà, on ne parle plus de bagage accompagné. */
export const MAX_PARCEL_KG = 30;

/** Le cran. Un demi-kilo est la plus petite différence qui change une décision. */
export const PARCEL_STEP_KG = 0.5;

/**
 * Les poids que les gens envoient vraiment — des repères, pas une contrainte :
 * le pas-à-pas atteint n'importe quelle valeur du domaine.
 */
export const PARCEL_PRESETS_KG = [1, 2, 5, 10, 20] as const;

/** Ramène un poids dans le domaine, et sur un cran. */
export function clampParcelKg(kg: number): number {
  const borne = Math.min(Math.max(kg, MIN_PARCEL_KG), MAX_PARCEL_KG);
  const crans = Math.round(borne / PARCEL_STEP_KG) * PARCEL_STEP_KG;
  // Le produit flottant rouvre des 2.4000000000000004 : on referme à la
  // précision du pas, qui n'a qu'une décimale.
  return Math.round(crans * 10) / 10;
}

/** Un cran vers le haut ou vers le bas, sans jamais sortir du domaine. */
export function stepParcelKg(kg: number, direction: 1 | -1): number {
  return clampParcelKg(kg + direction * PARCEL_STEP_KG);
}

/** Peut-on encore avancer dans cette direction ? (pour éteindre le bouton) */
export function canStepParcelKg(kg: number, direction: 1 | -1): boolean {
  return stepParcelKg(kg, direction) !== clampParcelKg(kg);
}

/**
 * Le poids écrit pour un humain : « 1,5 » en français, « 1.5 » en anglais.
 * D101 5A — le site le mettait en forme avec `toLocaleString("fr-FR")` EN DUR,
 * donc « 1,5 kg » jusque dans l'interface anglaise. Troisième occurrence du
 * motif de D99 1A : un nombre mis en forme à la main, hors de toute règle.
 */
export function formatParcelKg(kg: number, localeTag: string): string {
  return kg.toLocaleString(localeTag, { maximumFractionDigits: 1 });
}
