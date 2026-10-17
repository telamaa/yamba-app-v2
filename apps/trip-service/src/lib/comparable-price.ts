/**
 * comparable-price.ts — D33 : rendre comparables PER_KG et legacy.
 * =================================================================
 * `comparablePriceCents` = coût de transport d'un COLIS DE RÉFÉRENCE de
 * 2 kg, en cents entiers :
 *   PER_KG  → max(REFERENCE_KG, PLANCHER_KG) × pricePerKgCents      (D81)
 *   legacy  → minPriceCents (le prix par catégorie le plus bas)
 *   aucun   → null (le trajet n'apparaît pas dans le tri par prix)
 * PER_KG prime quand les deux moteurs sont présents (A28).
 */

export const REFERENCE_KG = 2;
/**
 * D81 — le plancher est en KILOS. Le colis de référence n'a pas de taille (c'est
 * un étalon de comparabilité) : il ne porte donc aucun minimum de taille, et le
 * plancher s'applique comme pour un S. Le prix comparable reste ainsi exactement
 * ce que paierait l'Expéditeur du colis de référence.
 */
export const BILLING_FLOOR_KG = 2.3;

/** D62 — les deux curseurs viennent des paramètres (`pricing.referenceKg`, `pricing.billingFloorKg`) ; les constantes sont les défauts. */
export type ComparableParams = { referenceKg: number; billingFloorKg: number };
export const DEFAULT_COMPARABLE_PARAMS: ComparableParams = { referenceKg: REFERENCE_KG, billingFloorKg: BILLING_FLOOR_KG };
export function comparableParamsFromSettings(v: { "pricing.referenceKg": number; "pricing.billingFloorKg": number }): ComparableParams {
  return { referenceKg: v["pricing.referenceKg"], billingFloorKg: v["pricing.billingFloorKg"] };
}

export function computeComparablePriceCents(input: {
  pricePerKgCents?: number | null;
  minPriceCents?: number | null;
}, p: ComparableParams = DEFAULT_COMPARABLE_PARAMS): number | null {
  if (typeof input.pricePerKgCents === "number" && input.pricePerKgCents > 0) {
    return Math.round(input.pricePerKgCents * Math.max(p.referenceKg, p.billingFloorKg));
  }
  if (typeof input.minPriceCents === "number" && input.minPriceCents > 0) {
    return input.minPriceCents;
  }
  return null;
}
