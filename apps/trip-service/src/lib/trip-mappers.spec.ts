import { mapTripToYambaResult, type TripWithRelations } from "./trip-mappers";

/** Fixture minimale : seuls les champs lus par le mapper (cast assumé). */
function fixture(overrides: Record<string, unknown> = {}): TripWithRelations {
  return {
    id: "t1",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    originTimezone: "Europe/Paris",
    destinationTimezone: "Africa/Brazzaville",
    departureAt: new Date("2026-09-12T08:00:00.000Z"),
    arrivalAt: null,
    departureTimeLocal: null,
    arrivalTimeLocal: null,
    transportMode: "PLANE",
    flightLayoverCities: [],
    trainStopCities: [],
    categoryConditions: [],
    acceptedCategories: [],
    familyConditions: [{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE", surchargePct: null }],
    minPriceCents: null,
    pricePerKgCents: 1150,
    capacityKg: 23,
    reservedKg: 5,
    maxSlots: null,
    bookedSlots: 0,
    instantBooking: false,
    ticketVerificationStatus: "NOT_SUBMITTED",
    currencyCode: "EUR",
    user: null,
    carrierPage: null,
    ...overrides,
  } as unknown as TripWithRelations;
}

describe("mapTripToYambaResult — tolérance et moteur PER_KG", () => {
  it("un trajet SANS arrivalAt n'est plus écarté : arrivée « — », pas de durée", () => {
    const dto = mapTripToYambaResult(fixture(), "fr");
    expect(dto.arrivalTime).toBe("—");
    expect(dto.durationMinutes).toBeUndefined();
    expect(dto.nextDay).toBeUndefined();
    expect(dto.fromCity).toBe("Paris");
  });

  it("expose pricePerKg (euros), remainingKg et les familles ≠ ACCEPT", () => {
    const dto = mapTripToYambaResult(fixture(), "fr");
    expect(dto.pricePerKg).toBe(11.5);
    expect(dto.remainingKg).toBe(18);
    expect(dto.familyConditions).toEqual([{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE", surchargePct: null }]);
    expect(dto.minPrice).toBe(0);
  });

  it("sans departureAt → rejeté (critère de recherche)", () => {
    expect(() => mapTripToYambaResult(fixture({ departureAt: null }), "fr")).toThrow(/departureAt/);
  });
});
