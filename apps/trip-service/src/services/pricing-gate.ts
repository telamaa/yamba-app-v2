/**
 * pricing-gate.ts — le gate de publication bi-moteur (D13/D14, A28)
 * ==================================================================
 * PUR (pattern trip-state-machine) : zéro dépendance, testable sans
 * mock. Appelé par les DEUX chemins de publication du controller
 * (publishTrip et updateTrip publish=true) — une seule vérité.
 *
 * Un trip ne se publie qu'avec UN moteur COMPLET :
 *   PER_KG       : pricePerKgCents > 0 ET capacityKg > 0 (prime si
 *                  les deux moteurs sont complets — transition A28)
 *   PER_CATEGORY : au moins une condition forfaitaire (legacy)
 *   null         : publication refusée (message unique ci-dessous)
 * Un moteur à moitié (€/kg sans capacité, ou l'inverse) = null.
 */

export type PricingEngine = "PER_KG" | "PER_CATEGORY";

export type PricingEngineInput = {
  pricePerKgCents?: number | null;
  capacityKg?: number | null;
  categoryConditions?: unknown[] | null;
};

export const PRICING_GATE_MESSAGE =
  "A complete pricing engine is required to publish: either per-category prices, or a price per kg plus a capacity in kg (D13).";

export function resolvePricingEngine(
  input: PricingEngineInput
): PricingEngine | null {
  const perKgComplete =
    typeof input.pricePerKgCents === "number" &&
    input.pricePerKgCents > 0 &&
    typeof input.capacityKg === "number" &&
    input.capacityKg > 0;
  if (perKgComplete) return "PER_KG";
  if (input.categoryConditions && input.categoryConditions.length > 0) {
    return "PER_CATEGORY";
  }
  return null;
}
