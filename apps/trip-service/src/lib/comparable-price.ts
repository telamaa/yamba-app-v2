/**
 * comparable-price.ts — D33 : rendre comparables PER_KG et legacy.
 * =================================================================
 * `comparablePriceCents` = coût de transport d'un COLIS DE RÉFÉRENCE de
 * 2 kg, en cents entiers :
 *   PER_KG  → max(REFERENCE_KG × pricePerKgCents, plancher D32)
 *   legacy  → minPriceCents (le prix par catégorie le plus bas)
 *   aucun   → null (le trajet n'apparaît pas dans le tri par prix)
 * PER_KG prime quand les deux moteurs sont présents (A28).
 */

export const REFERENCE_KG = 2;
/** D32 — prix plancher par colis (transport), cents. Paramètre §13. */
export const MIN_TRANSPORT_CENTS = 800;

export function computeComparablePriceCents(input: {
  pricePerKgCents?: number | null;
  minPriceCents?: number | null;
}): number | null {
  if (typeof input.pricePerKgCents === "number" && input.pricePerKgCents > 0) {
    return Math.max(Math.round(input.pricePerKgCents * REFERENCE_KG), MIN_TRANSPORT_CENTS);
  }
  if (typeof input.minPriceCents === "number" && input.minPriceCents > 0) {
    return input.minPriceCents;
  }
  return null;
}
