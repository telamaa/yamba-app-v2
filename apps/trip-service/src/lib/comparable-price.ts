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

/** D62 — les deux curseurs viennent des paramètres (`pricing.referenceKg`, `pricing.minTransportCents`) ; les constantes sont les défauts. */
export type ComparableParams = { referenceKg: number; minTransportCents: number };
export const DEFAULT_COMPARABLE_PARAMS: ComparableParams = { referenceKg: REFERENCE_KG, minTransportCents: MIN_TRANSPORT_CENTS };
export function comparableParamsFromSettings(v: { "pricing.referenceKg": number; "pricing.minTransportCents": number }): ComparableParams {
  return { referenceKg: v["pricing.referenceKg"], minTransportCents: v["pricing.minTransportCents"] };
}

export function computeComparablePriceCents(input: {
  pricePerKgCents?: number | null;
  minPriceCents?: number | null;
}, p: ComparableParams = DEFAULT_COMPARABLE_PARAMS): number | null {
  if (typeof input.pricePerKgCents === "number" && input.pricePerKgCents > 0) {
    return Math.max(Math.round(input.pricePerKgCents * p.referenceKg), p.minTransportCents);
  }
  if (typeof input.minPriceCents === "number" && input.minPriceCents > 0) {
    return input.minPriceCents;
  }
  return null;
}
