/**
 * reputation.service.spec.ts — niveaux de réputation (B5, D29①, REP-03) : fonctions pures
 */
import { averageOf, computeReputationLevel } from "./reputation.service";

describe("computeReputationLevel — critères affichés, seuils serveur", () => {
  it("Voyageur : NEW < 3 deals · CONFIRMED ≥ 3 · TOP ≥ 10 deals, note ≥ 4,8, 0 annulation après acceptation", () => {
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 5, ratingsCount: 2, completedDealsCount: 2, lateCancellationsCount: 0 })).toBe("NEW");
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 4.9, ratingsCount: 3, completedDealsCount: 3, lateCancellationsCount: 0 })).toBe("CONFIRMED");
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 4.8, ratingsCount: 8, completedDealsCount: 10, lateCancellationsCount: 0 })).toBe("TOP");
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 4.7, ratingsCount: 8, completedDealsCount: 10, lateCancellationsCount: 0 })).toBe("CONFIRMED");
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 5, ratingsCount: 8, completedDealsCount: 12, lateCancellationsCount: 1 })).toBe("CONFIRMED");
    // TOP exige au moins un avis révélé : 10 deals sans note = CONFIRMED
    expect(computeReputationLevel("CARRIER", { ratingsAvg: 0, ratingsCount: 0, completedDealsCount: 10, lateCancellationsCount: 0 })).toBe("CONFIRMED");
  });

  it("Expéditeur (miroir « fiable ») : TOP dès 5 deals, note ≥ 4,8, 0 annulation tardive", () => {
    expect(computeReputationLevel("SHIPPER", { ratingsAvg: 4.9, ratingsCount: 4, completedDealsCount: 5, lateCancellationsCount: 0 })).toBe("TOP");
    expect(computeReputationLevel("SHIPPER", { ratingsAvg: 4.9, ratingsCount: 4, completedDealsCount: 5, lateCancellationsCount: 1 })).toBe("CONFIRMED");
    expect(computeReputationLevel("SHIPPER", { ratingsAvg: 0, ratingsCount: 0, completedDealsCount: 0, lateCancellationsCount: 0 })).toBe("NEW");
  });

  it("averageOf : arrondi au dixième, 0 sans avis", () => {
    expect(averageOf([])).toBe(0);
    expect(averageOf([5, 4, 4])).toBe(4.3);
    expect(averageOf([4.8, 4.8])).toBe(4.8);
  });
});
