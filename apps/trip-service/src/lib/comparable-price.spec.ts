import { computeComparablePriceCents } from "./comparable-price";

describe("computeComparablePriceCents — D33 colis de référence 2 kg", () => {
  it("PER_KG 12 €/kg → 24 €", () => {
    expect(computeComparablePriceCents({ pricePerKgCents: 1200 })).toBe(2400);
  });
  it("PER_KG très bas (3 €/kg) → plancher D32 8 €", () => {
    expect(computeComparablePriceCents({ pricePerKgCents: 300 })).toBe(800);
  });
  it("legacy seul → minPriceCents", () => {
    expect(computeComparablePriceCents({ minPriceCents: 1500 })).toBe(1500);
  });
  it("les deux → PER_KG prime (A28)", () => {
    expect(computeComparablePriceCents({ pricePerKgCents: 1200, minPriceCents: 1500 })).toBe(2400);
  });
  it("aucun moteur → null", () => {
    expect(computeComparablePriceCents({})).toBeNull();
    expect(computeComparablePriceCents({ pricePerKgCents: 0, minPriceCents: null })).toBeNull();
  });
});
