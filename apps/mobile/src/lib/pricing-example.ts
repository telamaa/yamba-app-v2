/**
 * pricing-example.ts — « ex. colis 2 kg ≈ 27 € » sous un prix au kilo.
 * ====================================================================
 * MIROIR de `apps/user-ui/src/lib/pricing-example.ts` (les valeurs §13 du
 * mockup) — les deux fronts doivent annoncer la MÊME estimation. Projection
 * INDICATIVE : le prix réel est calculé et figé côté serveur (snapshot D17).
 *
 *   transport = max(max(poids, 0,5 kg) × €/kg, plancher 8 €)      (D13, D32)
 *   service   = max(12 % du transport, 3 €)                        (D16)
 *   total     = transport + service
 *
 * Tout en CENTS entiers (règle non négociable) — la conversion en euros
 * n'a lieu qu'à l'affichage.
 */

export const PRICING_EXAMPLE_PARAMS = {
  /** poids du colis d'exemple affiché */
  exampleWeightKg: 2,
  /** D32 — poids facturable minimum */
  minBillableKg: 0.5,
  /** D32 — prix plancher par colis (transport), cents */
  minTransportCents: 800,
  /** D16 — commission Expéditeur */
  commissionPct: 12,
  /** D16 — plancher de commission, cents */
  commissionFloorCents: 300,
} as const;

export function estimateShipperTotalCents(
  pricePerKgCents: number,
  weightKg: number = PRICING_EXAMPLE_PARAMS.exampleWeightKg,
  p = PRICING_EXAMPLE_PARAMS
): { transportCents: number; serviceCents: number; totalCents: number } {
  const billableKg = Math.max(weightKg, p.minBillableKg);
  const transportCents = Math.max(Math.round(pricePerKgCents * billableKg), p.minTransportCents);
  const serviceCents = Math.max(Math.round((transportCents * p.commissionPct) / 100), p.commissionFloorCents);
  return { transportCents, serviceCents, totalCents: transportCents + serviceCents };
}

/** D32 — plancher par colis, en euros (pour les libellés « Colis léger… »). */
export const MIN_PARCEL_PRICE_EUR = PRICING_EXAMPLE_PARAMS.minTransportCents / 100;
