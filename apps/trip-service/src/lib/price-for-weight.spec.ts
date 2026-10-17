import { sortByPriceForWeight, totalForWeightCents, transportForWeightCents } from "./price-for-weight";

describe("price-for-weight — prix d'un colis donné (D13/D16/D32)", () => {
  it("PER_KG 12 €/kg, 3 kg → transport 36 €, total 40,32 €", () => {
    expect(transportForWeightCents({ pricePerKgCents: 1200 }, 3)).toBe(3600);
    expect(totalForWeightCents({ pricePerKgCents: 1200 }, 3)).toBe(3600 + 432);
  });
  it("D81 — PER_KG 12 €/kg, 0,2 kg → facturé au plancher de 2,3 kg → 27,60 €", () => {
    expect(transportForWeightCents({ pricePerKgCents: 1200 }, 0.2)).toBe(2760);
    // service = 12 % de 27,60 € = 3,31 €, au-dessus de son plancher de 3 €
    expect(totalForWeightCents({ pricePerKgCents: 1200 }, 0.2)).toBe(3091);
  });
  it("D81 — la recherche n'applique AUCUN minimum de taille : elle ne connaît que le poids", () => {
    // Le prix annoncé est celui d'un colis S — le plus bas possible pour ce
    // poids. Il ne promet jamais moins cher que le devis, il peut seulement être
    // dépassé si l'Expéditeur choisit M ou L dans le tunnel.
    expect(transportForWeightCents({ pricePerKgCents: 350 }, 1)).toBe(805);
    expect(transportForWeightCents({ pricePerKgCents: 350 }, 5)).toBe(1750);
  });
  it("legacy : prix par colis, indépendant du poids", () => {
    expect(transportForWeightCents({ minPriceCents: 1500 }, 10)).toBe(1500);
  });
  it("aucun moteur → null", () => {
    expect(totalForWeightCents({}, 2)).toBeNull();
  });
  it("tri : le crossover legacy/PER_KG dépend du poids", () => {
    // D81 — le plancher en kilos DÉPLACE le crossover : sous 2,3 kg, un trajet
    // PER_KG ne descend plus sous 2,3 × son tarif, alors qu'un plancher en euros
    // le ramenait toujours à 8 €. Le tri reste juste, les seuils changent.
    const perKg = { id: "a", pricePerKgCents: 500 };
    const legacy = { id: "b", minPriceCents: 1500 };
    expect(sortByPriceForWeight([legacy, perKg], 1).map((t) => t.id)).toEqual(["a", "b"]); // 11,50 € < 15 €
    expect(sortByPriceForWeight([legacy, perKg], 4).map((t) => t.id)).toEqual(["b", "a"]); // 15 € < 20 €
    expect(sortByPriceForWeight([{ id: "c" }, perKg], 2).map((t) => t.id)).toEqual(["a", "c"]); // null dernier
  });
});
