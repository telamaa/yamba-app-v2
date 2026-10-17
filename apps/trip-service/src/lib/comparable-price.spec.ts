import { computeComparablePriceCents } from "./comparable-price";

/**
 * D81 — le colis de référence pèse 2 kg, mais il est FACTURÉ au plancher (2,3 kg)
 * comme n'importe quel colis : le prix comparable reste donc exactement ce que
 * paierait son Expéditeur. Avant, un plancher en EUROS (8 €) écrasait les
 * corridors bon marché et les rendait tous identiques dans le tri par prix.
 */
describe("computeComparablePriceCents — D33 colis de référence 2 kg, facturé au plancher", () => {
  it("PER_KG 12 €/kg → 27,60 € (2,3 kg facturés)", () => {
    expect(computeComparablePriceCents({ pricePerKgCents: 1200 })).toBe(2760);
  });
  it("D81 — PER_KG très bas (3 €/kg) → 6,90 €, et PLUS un plancher en euros", () => {
    // Avant : 8 € pour tout le monde sous 2,67 €/kg — deux corridors bon marché
    // étaient indiscernables dans le tri. Le plancher suit désormais le tarif.
    expect(computeComparablePriceCents({ pricePerKgCents: 300 })).toBe(690);
    expect(computeComparablePriceCents({ pricePerKgCents: 200 })).toBe(460);
  });
  it("legacy seul → minPriceCents", () => {
    expect(computeComparablePriceCents({ minPriceCents: 1500 })).toBe(1500);
  });
  it("les deux → PER_KG prime (A28)", () => {
    expect(computeComparablePriceCents({ pricePerKgCents: 1200, minPriceCents: 1500 })).toBe(2760);
  });
  it("aucun moteur → null", () => {
    expect(computeComparablePriceCents({})).toBeNull();
    expect(computeComparablePriceCents({ pricePerKgCents: 0, minPriceCents: null })).toBeNull();
  });
});
