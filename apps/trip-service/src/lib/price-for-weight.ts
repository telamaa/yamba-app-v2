/**
 * price-for-weight.ts — le prix d'UN colis donné sur UN trajet (D13/D16/D32).
 * ==========================================================================
 * Pur, en cents entiers. Utilisé par la recherche quand l'Expéditeur a
 * saisi le poids de son colis : chaque carte affiche « ≈ N € tout compris
 * pour 3 kg » et le tri « Prix le plus bas » se fait pour CE poids.
 *
 *   transport = PER_KG  → max(poids, PLANCHER_KG) × €/kg                (D81)
 *               legacy  → minPriceCents (prix par colis, indépendant du poids)
 *
 * D81 — la recherche connaît le POIDS, jamais la taille : elle n'applique donc
 * aucun minimum de taille. Le prix affiché est celui d'un colis S, c'est-à-dire
 * le PLUS BAS possible pour ce poids — il ne promet jamais moins cher que la
 * réalité du devis, il peut seulement être dépassé si l'Expéditeur choisit M ou L.
 *   service   = max(12 % du transport, 3 €)                     (D16)
 *   total     = transport + service
 *
 * D62 — les paramètres viennent de la plateforme (`pricing.*`) : chaque fonction les
 * reçoit en argument, `PRICING_PARAMS` n'est que le défaut (les anciennes constantes).
 */

export type WeightPricingParams = { billingFloorKg: number; commissionPct: number; commissionFloorCents: number };
export const PRICING_PARAMS: WeightPricingParams = {
  billingFloorKg: 2.3,
  commissionPct: 12,
  commissionFloorCents: 300,
};
export function weightPricingFromSettings(v: { "pricing.billingFloorKg": number; "pricing.commissionPct": number; "pricing.commissionFloorCents": number }): WeightPricingParams {
  return { billingFloorKg: v["pricing.billingFloorKg"], commissionPct: v["pricing.commissionPct"], commissionFloorCents: v["pricing.commissionFloorCents"] };
}

export type WeightPriceInput = {
  pricePerKgCents?: number | null;
  minPriceCents?: number | null;
};

/** Transport (net Voyageur) pour ce poids, ou null si aucun moteur. */
export function transportForWeightCents(trip: WeightPriceInput, weightKg: number, p: WeightPricingParams = PRICING_PARAMS): number | null {
  if (typeof trip.pricePerKgCents === "number" && trip.pricePerKgCents > 0) {
    const billable = Math.max(weightKg, p.billingFloorKg);
    return Math.round(trip.pricePerKgCents * billable);
  }
  if (typeof trip.minPriceCents === "number" && trip.minPriceCents > 0) {
    return trip.minPriceCents;
  }
  return null;
}

export function serviceCents(transportCents: number, p: WeightPricingParams = PRICING_PARAMS): number {
  return Math.max(Math.round((transportCents * p.commissionPct) / 100), p.commissionFloorCents);
}

export function totalForWeightCents(trip: WeightPriceInput, weightKg: number, p: WeightPricingParams = PRICING_PARAMS): number | null {
  const transport = transportForWeightCents(trip, weightKg, p);
  return transport === null ? null : transport + serviceCents(transport, p);
}

/**
 * Tri en mémoire par prix pour un poids : clé = transport (null → dernier),
 * puis id pour la stabilité de la pagination.
 */
export function sortByPriceForWeight<T extends WeightPriceInput & { id: string }>(
  trips: T[],
  weightKg: number,
  p: WeightPricingParams = PRICING_PARAMS
): T[] {
  return [...trips].sort((a, b) => {
    const ka = transportForWeightCents(a, weightKg, p) ?? Number.POSITIVE_INFINITY;
    const kb = transportForWeightCents(b, weightKg, p) ?? Number.POSITIVE_INFINITY;
    if (ka !== kb) return ka - kb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
