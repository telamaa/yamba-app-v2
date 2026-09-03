/**
 * booking-request.spec.ts — la naissance du deal, règle par règle (B2)
 */
import { QuoteError } from "@packages/pricing";
import {
  ACCEPTANCE_WINDOW_HOURS,
  BookingRequestError,
  FAMILY_DEFAULT_CATEGORY,
  assertQuoteMatches,
  buildBookingSnapshots,
  buildQuoteInput,
  capacityReservationWhere,
  checkCapacity,
  checkTripBookable,
  kgToReserve,
  quoteForTrip,
  remainingKg,
  resolveFamilySurcharge,
  type TripForBooking,
} from "./booking-request";
import { CreateBookingRequestSchema, type CreateBookingRequest } from "@packages/api-contracts";

const NOW = new Date("2026-09-01T10:00:00.000Z");

const trip = (over: Partial<TripForBooking> = {}): TripForBooking => ({
  id: "64b000000000000000000001",
  userId: "64b000000000000000000010",
  status: "PUBLISHED",
  isDeleted: false,
  departureAt: new Date("2026-09-10T08:00:00.000Z"),
  originCity: "Paris",
  originCountryCode: "FR",
  originTimezone: "Europe/Paris",
  destinationCity: "Brazzaville",
  destinationCountryCode: "CG",
  destinationTimezone: "Africa/Brazzaville",
  transportMode: "PLANE",
  pricePerKgCents: 1200,
  checkedBag23PriceCents: 18000,
  cabinBag12PriceCents: null,
  capacityKg: 20,
  reservedKg: 5,
  familyConditions: [
    { familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 },
    { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE", surchargePct: null },
  ],
  ...over,
});

const input = (over: Partial<CreateBookingRequest> = {}): CreateBookingRequest => ({
  tripId: "64b000000000000000000001",
  paymentIntentId: "pi_fake_1",
  product: "PARCEL",
  family: "CLOTHES_TEXTILE",
  sizeClass: "M",
  weightKg: 2,
  protection: "BASIC",
  expectedTotalCents: 0,
  description: "Vêtements enfants, sac fermé",
  declaredValueCents: 12000,
  photoUrls: [],
  recipient: { firstName: "Aminata", lastName: "N.", phoneE164: "+242061234567", email: "a@x.io" },
  pickupPlace: { kind: "AIRPORT", details: "CDG T2" },
  deliveryPlace: null,
  charterAccepted: true,
  termsAccepted: true,
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof BookingRequestError ? e.code : `not-a-booking-error:${String(e)}`;
  }
  return "no-error";
};

describe("resolveFamilySurcharge (CAT-03)", () => {
  it("famille sans condition → 0 %", () => {
    expect(resolveFamilySurcharge(trip(), "CLOTHES_TEXTILE")).toBe(0);
  });
  it("SURCHARGE → le pourcentage du Voyageur", () => {
    expect(resolveFamilySurcharge(trip(), "ELECTRONICS_DEVICES")).toBe(20);
  });
  it("REFUSE → FAMILY_REFUSED", () => {
    expect(code(() => resolveFamilySurcharge(trip(), "FOOD_DRY_SEALED"))).toBe("FAMILY_REFUSED");
  });
});

describe("checkTripBookable", () => {
  it("trajet publié, futur, d'un autre → OK", () => {
    expect(code(() => checkTripBookable(trip(), "64b000000000000000000020", NOW))).toBe("no-error");
  });
  it("son propre trajet → OWN_TRIP", () => {
    expect(code(() => checkTripBookable(trip(), "64b000000000000000000010", NOW))).toBe("OWN_TRIP");
  });
  it("brouillon / masqué / supprimé → TRIP_NOT_BOOKABLE", () => {
    expect(code(() => checkTripBookable(trip({ status: "DRAFT" }), "x", NOW))).toBe("TRIP_NOT_BOOKABLE");
    expect(code(() => checkTripBookable(trip({ status: "PAUSED" }), "x", NOW))).toBe("TRIP_NOT_BOOKABLE");
    expect(code(() => checkTripBookable(trip({ isDeleted: true }), "x", NOW))).toBe("TRIP_NOT_BOOKABLE");
  });
  it("déjà parti → TRIP_NOT_BOOKABLE", () => {
    expect(code(() => checkTripBookable(trip({ departureAt: new Date("2026-08-01") }), "x", NOW))).toBe(
      "TRIP_NOT_BOOKABLE"
    );
  });
});

describe("buildQuoteInput + quoteForTrip (D34 : le même moteur que le front)", () => {
  it("colis 2 kg M, 12 €/kg, sans supplément → 26,40 € transport, 3,17 € commission", () => {
    const q = quoteForTrip(trip(), input());
    expect(q.transportCents).toBe(2640);
    expect(q.commissionCents).toBe(317);
    expect(q.totalShipperCents).toBe(2957);
    expect(q.capacityKgConsumed).toBe(2);
  });
  it("le supplément de famille du Voyageur entre dans le devis", () => {
    const q = quoteForTrip(trip(), input({ family: "ELECTRONICS_DEVICES" }));
    expect(q.familySurchargePct).toBe(20);
    expect(q.transportCents).toBe(Math.round(1200 * 2 * 1.1 * 1.2));
  });
  it("bagage 23 kg → forfait, poids/sizeClass ignorés, 23 kg consommés", () => {
    const qi = buildQuoteInput(trip(), input({ product: "CHECKED_BAG_23KG", weightKg: 2, sizeClass: "M" }));
    expect(qi.weightKg).toBeNull();
    expect(qi.sizeClass).toBeNull();
    const q = quoteForTrip(trip(), input({ product: "CHECKED_BAG_23KG" }));
    expect(q.pricingModel).toBe("FLAT_BAG");
    expect(q.transportCents).toBe(18000);
    expect(q.capacityKgConsumed).toBe(23);
  });
  it("bagage cabine non proposé par le Voyageur → QuoteError du moteur (→ 400)", () => {
    expect(() => quoteForTrip(trip(), input({ product: "CABIN_BAG_12KG" }))).toThrow(QuoteError);
  });
});

describe("assertQuoteMatches (D17)", () => {
  it("même total → OK ; total différent → QUOTE_DIVERGENCE avec les deux montants", () => {
    const q = quoteForTrip(trip(), input());
    expect(code(() => assertQuoteMatches(q, q.totalShipperCents))).toBe("no-error");
    try {
      assertQuoteMatches(q, q.totalShipperCents - 100);
      fail("should throw");
    } catch (e) {
      const err = e as BookingRequestError;
      expect(err.code).toBe("QUOTE_DIVERGENCE");
      expect(err.statusCode).toBe(409);
      expect(err.details).toMatchObject({ type: "booking", code: "QUOTE_DIVERGENCE", actualTotalCents: q.totalShipperCents });
    }
  });
});

describe("capacité (CAP-01)", () => {
  it("remainingKg = capacité − réservé ; null sans capacité déclarée", () => {
    expect(remainingKg(trip())).toBe(15);
    expect(remainingKg(trip({ capacityKg: null }))).toBeNull();
  });
  it("kg à réserver = poids déclaré du colis (pas le facturable) / franchise du bagage", () => {
    expect(kgToReserve(quoteForTrip(trip(), input({ weightKg: 0.2 })))).toBe(0.2);
    expect(kgToReserve(quoteForTrip(trip(), input({ product: "CHECKED_BAG_23KG" })))).toBe(23);
  });
  it("dépassement → CAPACITY_EXCEEDED ; exactement le reste → OK", () => {
    expect(code(() => checkCapacity(trip(), 15))).toBe("no-error");
    expect(code(() => checkCapacity(trip(), 15.5))).toBe("CAPACITY_EXCEEDED");
    expect(code(() => checkCapacity(trip({ capacityKg: null }), 100))).toBe("no-error");
  });
  it("A34 — WHERE de réservation : condition dans le filtre, aucune sans capacité déclarée", () => {
    expect(capacityReservationWhere(trip(), 2)).toEqual({
      id: "64b000000000000000000001",
      status: "PUBLISHED",
      reservedKg: { lte: 18 },
    });
    expect(capacityReservationWhere(trip(), 25)).toEqual({
      id: "64b000000000000000000001",
      status: "PUBLISHED",
      reservedKg: { lte: -5 },
    });
    // pas de capacité déclarée : aucune condition de kg
    expect(capacityReservationWhere(trip({ capacityKg: null }), 2)).toEqual({
      id: "64b000000000000000000001",
      status: "PUBLISHED",
    });
  });
});

describe("buildBookingSnapshots (D17 : figé tel quel)", () => {
  it("colis : snapshots trip/pricing/parcel/recipient/lieux + fenêtre 24 h", () => {
    const q = quoteForTrip(trip(), input({ protection: "EXTENDED_500" }));
    const s = buildBookingSnapshots({ trip: trip(), input: input({ protection: "EXTENDED_500" }), quote: q, now: NOW });
    expect(s.trip).toMatchObject({ originCity: "Paris", destinationCountryCode: "CG", transportMode: "PLANE" });
    expect(s.pricing).toMatchObject({
      pricingModel: "PER_KG",
      product: "PARCEL",
      weightKg: 2,
      billableWeightKg: 2,
      sizeClass: "M",
      sizeCoef: 1.1,
      pricePerKgCents: 1200,
      transportCents: 2640,
      commissionPct: 0.12,
      commissionCents: 317,
      protectionProvider: "YAMBA_GUARANTEE",
      protectionTier: "EXTENDED_500",
      premiumCents: 600,
      serviceCents: 917,
      totalShipperCents: 3557,
      minimumApplied: false,
      currencyCode: "EUR",
    });
    expect(s.parcel).toMatchObject({ category: "CLOTHES", categoryFamily: "CLOTHES_TEXTILE", declaredValueCents: 12000 });
    // A85 — les listes EXISTENT dès la création (pitfall Mongo : une liste absente n'est matchée par aucun filtre).
    expect(s.trackingEvents).toEqual([]);
    expect(s.deliveryPhotoUrls).toEqual([]);
    expect(s.recipient.phoneE164).toBe("+242061234567");
    expect(s.pickupPlace).toEqual({ kind: "AIRPORT", details: "CDG T2" });
    expect(s.deliveryPlace).toBeNull();
    expect(s.expiresAt.getTime() - s.requestedAt.getTime()).toBe(ACCEPTANCE_WINDOW_HOURS * 3600_000);
  });
  it("bagage 23 kg : catégorie legacy = CHECKED_BAG_23KG, poids = 23", () => {
    const i = input({ product: "CHECKED_BAG_23KG" });
    const s = buildBookingSnapshots({ trip: trip(), input: i, quote: quoteForTrip(trip(), i), now: NOW });
    expect(s.parcel.category).toBe("CHECKED_BAG_23KG");
    expect(s.pricing.weightKg).toBe(23);
    expect(s.pricing.pricePerKgCents).toBeNull();
  });
  it("A29 — chaque famille a une catégorie legacy", () => {
    expect(Object.keys(FAMILY_DEFAULT_CATEGORY)).toHaveLength(8);
  });
  it("A34 — email destinataire optionnel : vide/absent → null figé, jamais une chaîne vide", () => {
    const snap = (email: string | null | undefined) => {
      const i = input({ recipient: { ...input().recipient, email } });
      return buildBookingSnapshots({ trip: trip(), input: i, quote: quoteForTrip(trip(), i), now: NOW }).recipient.email;
    };
    expect(snap("a@x.io")).toBe("a@x.io");
    expect(snap("  a@x.io  ")).toBe("a@x.io");
    expect(snap("")).toBeNull();
    expect(snap(null)).toBeNull();
    expect(snap(undefined)).toBeNull();
  });
});

describe("A34 — contrat CreateBookingRequest aligné sur le wizard", () => {
  // le fixture partagé a expectedTotalCents: 0 (hors contrat) — ici on parse le contrat, donc un corps valide
  const valid = (over: Partial<CreateBookingRequest> = {}) => input({ expectedTotalCents: 2834, ...over });
  it("description : min 5 (le plancher du wizard), 4 → refus", () => {
    expect(CreateBookingRequestSchema.safeParse(valid({ description: "Livre" })).success).toBe(true);
    expect(CreateBookingRequestSchema.safeParse(valid({ description: "Sac" })).success).toBe(false);
  });
  it("email destinataire optionnel (spec É1) : null/absent OK, invalide → refus", () => {
    const withEmail = (email: unknown) => ({ ...valid(), recipient: { ...valid().recipient, email } });
    expect(CreateBookingRequestSchema.safeParse(withEmail(null)).success).toBe(true);
    expect(CreateBookingRequestSchema.safeParse(withEmail(undefined)).success).toBe(true);
    expect(CreateBookingRequestSchema.safeParse(withEmail("a@x.io")).success).toBe(true);
    expect(CreateBookingRequestSchema.safeParse(withEmail("pas-un-email")).success).toBe(false);
  });
});
