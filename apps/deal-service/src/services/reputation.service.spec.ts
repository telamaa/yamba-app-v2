/**
 * reputation.service.spec.ts — niveaux de réputation (B5, D29①, REP-03) : fonctions pures
 */
const prismaMock = {
  review: { findMany: jest.fn() },
  booking: { count: jest.fn() },
  carrierPage: { findUnique: jest.fn(), update: jest.fn() },
  user: { update: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
jest.mock("@packages/libs/settings/default", () => ({ platformSettings: () => ({ get: async () => ({}) }) }));

import { averageOf, computeReputationLevel, recomputeReputation } from "./reputation.service";

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

/* ANO-WEB-10 — un refus au pickup (ACCEPTED → CANCELLED par le Voyageur, effets « sans pénalité ») ne
 * doit JAMAIS compter comme une annulation tardive : la requête des faits Voyageur exclut la marque
 * `pickupRefusedAt`, en voyant aussi les deals ANTÉRIEURS à la marque (champ absent, piège Mongo). */
describe("recomputeReputation — les annulations tardives du Voyageur excluent le refus au pickup", () => {
  const CARRIER_ID = "64b0000000000000000000c1";

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.review.findMany.mockResolvedValue([]);
    prismaMock.carrierPage.findUnique.mockResolvedValue({ id: "page" });
    prismaMock.carrierPage.update.mockResolvedValue({});
  });

  it("la requête des annulations tardives porte le filtre « pas de refus au pickup », absent compris", async () => {
    prismaMock.booking.count.mockResolvedValueOnce(4).mockResolvedValueOnce(0);
    await recomputeReputation(CARRIER_ID, "CARRIER");
    const requetes = prismaMock.booking.count.mock.calls.map((c) => c[0].where as Record<string, unknown>);
    const tardives = requetes.find((w) => w.status === "CANCELLED");
    expect(tardives).toEqual({
      carrierId: CARRIER_ID,
      status: "CANCELLED",
      closedBy: "CARRIER",
      isDeleted: false,
      acceptedAt: { not: null },
      OR: [{ pickupRefusedAt: null }, { pickupRefusedAt: { isSet: false } }],
    });
    expect(prismaMock.carrierPage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedDealsCount: 4, lateCancellationsCount: 0 }) })
    );
  });
});
