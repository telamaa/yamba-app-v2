import { checkBagCapacity, pickPerKgFields, resolvePricingEngine } from "./pricing-gate";

describe("resolvePricingEngine — gate bi-moteur (A28, D13)", () => {
  const legacyCond = [{ category: "DOCUMENTS_PAPERS", priceAmountCents: 1500 }];

  it("PER_KG complet (prix + capacité) → PER_KG", () => {
    expect(resolvePricingEngine({ pricePerKgCents: 1150, capacityKg: 12 })).toBe("PER_KG");
  });

  it("les DEUX moteurs complets → PER_KG prime (transition A28)", () => {
    expect(
      resolvePricingEngine({
        pricePerKgCents: 1150,
        capacityKg: 12,
        categoryConditions: legacyCond,
      })
    ).toBe("PER_KG");
  });

  it("legacy seul (conditions forfaitaires) → PER_CATEGORY", () => {
    expect(resolvePricingEngine({ categoryConditions: legacyCond })).toBe("PER_CATEGORY");
  });

  it("€/kg SANS capacité → null (moteur à moitié)", () => {
    expect(resolvePricingEngine({ pricePerKgCents: 1150 })).toBeNull();
  });

  it("capacité SANS €/kg → null (moteur à moitié)", () => {
    expect(resolvePricingEngine({ capacityKg: 12 })).toBeNull();
  });

  it("€/kg à 0 → null (positif strict)", () => {
    expect(resolvePricingEngine({ pricePerKgCents: 0, capacityKg: 12 })).toBeNull();
  });

  it("conditions VIDES → null", () => {
    expect(resolvePricingEngine({ categoryConditions: [] })).toBeNull();
  });

  it("aucune entrée → null", () => {
    expect(resolvePricingEngine({})).toBeNull();
  });
});

describe("checkBagCapacity — un forfait bagage exige sa franchise (PRC-04, RG-B-29)", () => {
  it("soute 23 kg avec capacité 23 → OK", () => {
    expect(checkBagCapacity({ capacityKg: 23, checkedBag23PriceCents: 23000 })).toBeNull();
  });
  it("soute 23 kg avec capacité 5 → refusé", () => {
    expect(checkBagCapacity({ capacityKg: 5, checkedBag23PriceCents: 10000 })).toMatch(/23kg/);
  });
  it("cabine 12 kg avec capacité 10 → refusé", () => {
    expect(checkBagCapacity({ capacityKg: 10, cabinBag12PriceCents: 5500 })).toMatch(/12kg/);
  });
  it("aucun forfait → toujours OK, même sans capacité", () => {
    expect(checkBagCapacity({ capacityKg: null })).toBeNull();
  });
});

describe("pickPerKgFields — les 5 champs PER_KG traversent l'écriture (régression PR-B : trip créé à 0 €)", () => {
  it("copie les 5 champs depuis un payload de création", () => {
    expect(
      pickPerKgFields({
        pricePerKgCents: 1100,
        capacityKg: 12,
        checkedBag23PriceCents: null,
        cabinBag12PriceCents: 3000,
        familyConditions: [{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }],
      })
    ).toEqual({
      pricePerKgCents: 1100,
      capacityKg: 12,
      checkedBag23PriceCents: null,
      cabinBag12PriceCents: 3000,
      familyConditions: [{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }],
    });
  });
  it("absents → null / [] (jamais undefined : Prisma ignorerait la clé)", () => {
    expect(pickPerKgFields({})).toEqual({
      pricePerKgCents: null,
      capacityKg: null,
      checkedBag23PriceCents: null,
      cabinBag12PriceCents: null,
      familyConditions: [],
    });
  });
});
