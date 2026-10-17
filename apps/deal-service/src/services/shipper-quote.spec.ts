import { PRICING_PARAMS, QuoteError, quoteShipperPrice } from "@packages/pricing";

/**
 * D34 — le moteur de prix Expéditeur partagé (front devis / serveur snapshot).
 * Chiffres du mockup : Marie 11,50 €/kg, Aminata 2,5 kg taille S.
 */
describe("quoteShipperPrice — D13/D16/D22/D81 (cents)", () => {
  it("mockup : 2,5 kg × 11,50 €/kg × S → transport 28,75 · service 3,45 · total 32,20", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 2.5, sizeClass: "S" });
    expect(q.transportCents).toBe(2875);
    expect(q.commissionCents).toBe(345);
    expect(q.premiumCents).toBe(0);
    expect(q.totalShipperCents).toBe(3220);
    expect(q.carrierNetCents).toBe(2875);
    // 2,5 kg dépasse le plancher (2,3) et le minimum de S (0) : le poids réel gagne.
    expect(q.billableReason).toBe("ACTUAL");
  });

  it("D81 : taille L → poids facturé 6 kg, et le supplément électronique s'applique DESSUS", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 2.5, sizeClass: "L", familySurchargePct: 20 });
    expect(q.billableWeightKg).toBe(6);
    expect(q.sizeMinKg).toBe(6);
    expect(q.billableReason).toBe("SIZE_MIN");
    expect(q.transportCents).toBe(Math.round(1150 * 6 * 1.2)); // 8280
    // `rawTransportCents` dit ce que coûterait le poids RÉEL — la différence est
    // exactement ce que l'Expéditeur paie pour la PLACE.
    expect(q.rawTransportCents).toBe(Math.round(1150 * 2.5 * 1.2)); // 3450
  });

  it("D81 : passeport 0,1 kg en S → le plancher de 2,3 kg décide ; commission au plancher", () => {
    const q = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1150, weightKg: 0.1, sizeClass: "S" });
    expect(q.billableWeightKg).toBe(2.3);
    expect(q.billingFloorKg).toBe(2.3);
    expect(q.billableReason).toBe("FLOOR");
    expect(q.rawTransportCents).toBe(115);
    expect(q.transportCents).toBe(2645);
    expect(q.commissionCents).toBe(Math.round(2645 * 0.12)); // 317, au-dessus du plancher de 3 €
  });

  /**
   * LE défaut qui a déclenché D81, en test de non-régression. Mesuré le 17/10 sur
   * un trajet à 3,50 €/kg : sous 1,83 kg, S, M et L donnaient EXACTEMENT 11 €.
   * La question de la taille ne changeait rien sur le colis le plus courant.
   */
  it("D81 — non-régression : sous 2 kg, les trois tailles ne donnent PLUS le même prix", () => {
    const quote = (sizeClass: "S" | "M" | "L") =>
      quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 350, weightKg: 1, sizeClass });
    const [s, m, l] = [quote("S"), quote("M"), quote("L")];

    expect(s.billableWeightKg).toBe(2.3); // le plancher
    expect(m.billableWeightKg).toBe(3); // le minimum de M
    expect(l.billableWeightKg).toBe(6); // le minimum de L
    expect(new Set([s.totalShipperCents, m.totalShipperCents, l.totalShipperCents]).size).toBe(3);

    // Et la continuité est tenue : en S sur un corridor court, le total reste
    // celui d'avant (11 € sous l'ancien plancher de 8 €) à cinq centimes près.
    expect(s.transportCents).toBe(805);
    expect(s.totalShipperCents).toBe(1105);
  });

  it("D81 — le plancher suit le corridor, sans paramètre supplémentaire", () => {
    const court = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 350, weightKg: 0.3, sizeClass: "S" });
    const long = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1200, weightKg: 0.3, sizeClass: "S" });
    expect(court.transportCents).toBe(805); // 2,3 × 3,50 €
    expect(long.transportCents).toBe(2760); // 2,3 × 12 € — le même plancher, en kilos
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

  it("D81 — paramètres par défaut : 12 % / 3 € / plancher 2,3 kg / S-M-L 0-3-6 / prime 6 €", () => {
    expect(PRICING_PARAMS.commissionPct).toBe(12);
    expect(PRICING_PARAMS.commissionFloorCents).toBe(300);
    expect(PRICING_PARAMS.billingFloorKg).toBe(2.3);
    expect(PRICING_PARAMS.sizeMinKg).toEqual({ S: 0, M: 3, L: 6 });
    expect(PRICING_PARAMS.protectionExtendedPremiumCents).toBe(600);
  });

  it("D81 — S ne porte AUCUN minimum : le petit objet de valeur n'est pas surtaxé", () => {
    // Sur un corridor cher, un minimum sur S renchérirait précisément la bague,
    // les lunettes ou le téléphone que le plancher est censé protéger.
    expect(PRICING_PARAMS.sizeMinKg.S).toBe(0);
    const bague = quoteShipperPrice({ product: "PARCEL", pricePerKgCents: 1200, weightKg: 0.05, sizeClass: "S" });
    expect(bague.billableReason).toBe("FLOOR");
    expect(bague.billableWeightKg).toBe(PRICING_PARAMS.billingFloorKg);
  });
});
