import { PRICING_PARAMS, QuoteError, quoteShipperPrice } from "@packages/pricing";

/**
 * D34 — le moteur de prix Expéditeur partagé (front devis / serveur snapshot).
 * Chiffres du mockup : Marie 11,50 €/kg, Aminata 2,5 kg taille S.
 */
describe("quoteShipperPrice — D13/D16/D22/D32 (cents)", () => {
  it("mockup : 2,5 kg × 11,50 €/kg × S → transport 28,75 · service 3,45 · total 32,20", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 2.5, sizeClass: "S" });
    expect(q.transportCents).toBe(2875);
    expect(q.commissionCents).toBe(345);
    expect(q.premiumCents).toBe(0);
    expect(q.totalShipperCents).toBe(3220);
    expect(q.carrierNetCents).toBe(2875);
    expect(q.minimumApplied).toBe(false);
  });

  it("taille L (×1,25) et supplément électronique +20 %", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 2.5, sizeClass: "L", familySurchargePct: 20 });
    expect(q.transportCents).toBe(Math.round(1150 * 2.5 * 1.25 * 1.2)); // 4313
    expect(q.sizeCoef).toBe(1.25);
  });

  it("D32 : passeport 0,1 kg → facturable 0,5 kg → 5,75 € → plancher 8 € ; commission plancher 3 €", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 0.1, sizeClass: "S" });
    expect(q.billableWeightKg).toBe(0.5);
    expect(q.rawTransportCents).toBe(575);
    expect(q.minimumApplied).toBe(true);
    expect(q.transportCents).toBe(800);
    expect(q.commissionFloorApplied).toBe(true);
    expect(q.commissionCents).toBe(300);
    expect(q.totalShipperCents).toBe(1100);
  });

  it("D22 : Garantie 500 € = +6 € dans « Service & protection », jamais dans le transport", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 2.5, sizeClass: "S", protection: "EXTENDED_500" });
    expect(q.premiumCents).toBe(600);
    expect(q.serviceCents).toBe(345 + 600);
    expect(q.transportCents).toBe(2875);
    expect(q.totalShipperCents).toBe(2875 + 945);
  });

  it("PRC-04 : bagage soute = forfait, consomme 23 kg, ni poids ni taille", () => {
    const q = quoteShipperPrice({ product: "CHECKED_BAG_23KG", checkedBag23PriceCents: 23000 });
    expect(q.pricingModel).toBe("FLAT_BAG");
    expect(q.transportCents).toBe(23000);
    expect(q.capacityKgConsumed).toBe(23);
    expect(q.commissionCents).toBe(2760);
  });

  it("erreurs typées : pas de €/kg, pas de poids, pas de taille, bagage non proposé", () => {
    expect(() => quoteShipperPrice({ product: "PARCEL", weightKg: 1, sizeClass: "S" })).toThrow(QuoteError);
    expect(() => quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1000, sizeClass: "S" })).toThrow(/weight/);
    expect(() => quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1000, weightKg: 1 })).toThrow(/size/);
    expect(() => quoteShipperPrice({ product: "CABIN_BAG_12KG" })).toThrow(/flat rate/);
  });

  it("paramètres §13 par défaut : 12 % / 3 € / 0,5 kg / 8 € / S-M-L 1-1,1-1,25 / prime 6 €", () => {
    expect(PRICING_PARAMS.commissionPct).toBe(12);
    expect(PRICING_PARAMS.commissionFloorCents).toBe(300);
    expect(PRICING_PARAMS.minBillableKg).toBe(0.5);
    expect(PRICING_PARAMS.minTransportCents).toBe(800);
    expect(PRICING_PARAMS.sizeCoef).toEqual({ S: 1, M: 1.1, L: 1.25 });
    expect(PRICING_PARAMS.protectionExtendedPremiumCents).toBe(600);
  });
});
