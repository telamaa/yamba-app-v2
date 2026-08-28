import { sortByPriceForWeight, totalForWeightCents, transportForWeightCents } from "./price-for-weight";

describe("price-for-weight — prix d'un colis donné (D13/D16/D32)", () => {
  it("PER_KG 12 €/kg, 3 kg → transport 36 €, total 40,32 €", () => {
    expect(transportForWeightCents({ pricePerKgCents: 1200 }, 3)).toBe(3600);
    expect(totalForWeightCents({ pricePerKgCents: 1200 }, 3)).toBe(3600 + 432);
  });
  it("PER_KG 12 €/kg, 0,2 kg → poids facturable 0,5 → 6 € → plancher 8 € ; service plancher 3 €", () => {
    expect(transportForWeightCents({ pricePerKgCents: 1200 }, 0.2)).toBe(800);
    expect(totalForWeightCents({ pricePerKgCents: 1200 }, 0.2)).toBe(1100);
  });
  it("legacy : prix par colis, indépendant du poids", () => {
    expect(transportForWeightCents({ minPriceCents: 1500 }, 10)).toBe(1500);
  });
  it("aucun moteur → null", () => {
    expect(totalForWeightCents({}, 2)).toBeNull();
  });
  it("tri : le crossover legacy/PER_KG dépend du poids", () => {
    const perKg = { id: "a", pricePerKgCents: 1200 };
    const legacy = { id: "b", minPriceCents: 1500 };
    expect(sortByPriceForWeight([legacy, perKg], 1).map((t) => t.id)).toEqual(["a", "b"]); // 12 € < 15 €
    expect(sortByPriceForWeight([legacy, perKg], 2).map((t) => t.id)).toEqual(["b", "a"]); // 15 € < 24 €
    expect(sortByPriceForWeight([{ id: "c" }, perKg], 2).map((t) => t.id)).toEqual(["a", "c"]); // null dernier
  });
});
