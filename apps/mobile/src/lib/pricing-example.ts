/**
 * pricing-example.ts — « ex. colis 2 kg ≈ 27 € » sous un prix au kilo.
 * ====================================================================
 * Projection INDICATIVE côté front pour ancrer l'Expéditeur (D15 : l'ancre
 * convertit). Le prix réel est calculé et figé côté serveur (snapshot D17).
 *
 *   transport = max(poids, PLANCHER_KG) × €/kg                      (D81)
 *   service   = max(12 % du transport, 3 €)                         (D16)
 *   total     = transport + service
 *
 * D81 — le plancher est en KILOS, plus en euros. Conséquence pour l'affichage :
 * il n'existe PLUS de « prix minimum » universel à annoncer, puisqu'il dépend
 * du tarif du Voyageur. Les libellés « colis léger » parlent donc du PLANCHER
 * EN KILOS, qui lui est vrai sur tous les corridors.
 *
 * Cette projection ne connaît que le POIDS, jamais la taille : elle rend donc
 * le prix d'un colis S — le plus bas possible. Elle ne promet jamais moins cher
 * que le devis du tunnel, elle peut seulement être dépassée en M ou L.
 *
 * Tout en CENTS entiers (règle non négociable) — la conversion en euros
 * n'a lieu qu'à l'affichage.
 */

export const PRICING_EXAMPLE_PARAMS = {
  /** poids du colis d'exemple affiché */
  exampleWeightKg: 2,
  /** D81 — plancher de facturation, en kilos */
  billingFloorKg: 2.3,
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
  const billableKg = Math.max(weightKg, p.billingFloorKg);
  const transportCents = Math.round(pricePerKgCents * billableKg);
  const serviceCents = Math.max(Math.round((transportCents * p.commissionPct) / 100), p.commissionFloorCents);
  return { transportCents, serviceCents, totalCents: transportCents + serviceCents };
}

/** D81 — le plancher, en kilos : la seule formulation vraie sur tous les corridors. */
export const BILLING_FLOOR_KG = PRICING_EXAMPLE_PARAMS.billingFloorKg;
