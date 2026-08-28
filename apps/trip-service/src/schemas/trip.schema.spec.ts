import { createTripSchema } from "./trip.schema";

/**
 * Validation de publication (publish: true) — coexistence bi-moteur A28.
 * acceptedCategories n'est exigé QUE pour le moteur legacy PER_CATEGORY :
 * un trajet PER_KG complet (prix + capacité) publie sans catégorie.
 */
describe("createTripSchema — publish gate categories vs PER_KG (A28)", () => {
  const base = {
    transportMode: "PLANE",
    flightType: "DIRECT",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    departureAt: new Date(Date.now() + 15 * 86_400_000).toISOString(),
    pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT" }],
    deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT" }],
    publish: true,
  };

  const issuesOn = (path: string, result: ReturnType<typeof createTripSchema.safeParse>) =>
    result.success ? [] : result.error.issues.filter((i) => i.path.join(".") === path);

  it("PER_KG complet SANS catégorie → aucune issue acceptedCategories", () => {
    const r = createTripSchema.safeParse({
      ...base,
      pricePerKgCents: 1150,
      capacityKg: 23,
      familyConditions: [
        { familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 },
        { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" },
      ],
    });
    expect(issuesOn("acceptedCategories", r)).toHaveLength(0);
  });

  it("legacy SANS catégorie → issue acceptedCategories (comportement historique conservé)", () => {
    const r = createTripSchema.safeParse({
      ...base,
      categoryConditions: [{ category: "CLOTHES", priceAmountCents: 1500 }],
    });
    expect(issuesOn("acceptedCategories", r)).toHaveLength(1);
  });

  it("€/kg SANS capacité (moteur à moitié) → catégories toujours exigées", () => {
    const r = createTripSchema.safeParse({ ...base, pricePerKgCents: 1150 });
    expect(issuesOn("acceptedCategories", r)).toHaveLength(1);
  });

  it("brouillon (publish absent) → jamais d'issue acceptedCategories", () => {
    const r = createTripSchema.safeParse({ ...base, publish: false });
    expect(issuesOn("acceptedCategories", r)).toHaveLength(0);
  });

  it("SURCHARGE sans surchargePct → refusé (miroir du contrat)", () => {
    const r = createTripSchema.safeParse({
      ...base,
      pricePerKgCents: 1150,
      capacityKg: 23,
      familyConditions: [{ familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE" }],
    });
    expect(r.success).toBe(false);
  });
});
