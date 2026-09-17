/**
 * trip-lifecycle-concurrency.controller.spec.ts — A196 : une transition s'écrit sur l'état qu'elle a LU
 * ======================================================================================================
 * Second cercle de la passe concurrence (après A192 côté admin et A195 côté membre). La machine à états
 * du trajet est « un miroir exécutable de la spec » — mais `canPerform(trip, …)` juge l'état **lu**, et
 * l'écriture qui suivait ne le rappelait pas : `prisma.trip.update({ where: { id } })` écrivait quel que
 * soit l'état devenu entre-temps.
 *
 * Trois conséquences, toutes silencieuses :
 *  - le Voyageur met en pause dans un onglet et annule dans l'autre : les deux passent la garde, le
 *    dernier écrit — une transition jouée depuis un état qui n'existait plus ;
 *  - double clic sur « Publier » : deux incréments du compteur public et DEUX vagues de notifications
 *    aux membres abonnés au corridor ;
 *  - un deal naît entre la garde et l'écriture de l'annulation : le trajet est annulé **avec un deal
 *    vivant**, ce que D72 interdit précisément.
 */
const prismaMock = {
  trip: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  carrierPage: { findUnique: jest.fn(), updateMany: jest.fn() },
};
const redisMock = { get: jest.fn(), set: jest.fn(), incr: jest.fn(), expire: jest.fn() };
const countActiveBookings = jest.fn(async () => 0);
const hasActiveBookings = jest.fn(async () => false);
const triggerTripPublishedNotifications = jest.fn();

jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }));
jest.mock("@packages/libs/redis/trip-stats", () => ({ recordTripView: jest.fn(), tripViews: jest.fn(), viewerKey: jest.fn() }));
jest.mock("../lib/imagekit", () => ({ __esModule: true, default: {} }));
jest.mock("../services/booking-queries", () => ({ countActiveBookings, hasActiveBookings }));
jest.mock("../services/trigger-trip-notifications", () => ({ triggerTripPublishedNotifications }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cancelTrip, pauseTrip, resumeTrip, publishTrip, archiveTrip } = require("./trip.controller") as typeof import("./trip.controller");

const VOYAGEUR = "64b000000000000000000001";
const TRIP = "64b0000000000000000000aa";

/** Le trajet tel que la requête l'a LU (c'est sur cet état que la machine a jugé). */
function trajet(over: Record<string, unknown> = {}) {
  return {
    id: TRIP,
    userId: VOYAGEUR,
    status: "PUBLISHED",
    isDeleted: false,
    reservedKg: 0,
    capacityKg: 20,
    departureAt: new Date("2026-12-01T10:00:00.000Z"),
    cancelledAt: null,
    publishedAt: new Date("2026-09-01T10:00:00.000Z"),
    categoryConditions: [],
    pricePerKgCents: 1000,
    originTimezone: "Europe/Paris",
    documents: [],
    ...over,
  };
}

async function appeler(handler: unknown, params: Record<string, string> = { id: TRIP }) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await (handler as (rq: never, rs: never, nx: never) => Promise<unknown>)({ user: { id: VOYAGEUR }, params, body: {}, headers: {} } as never, res as never, next as never);
  return { res, next, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: Record<string, unknown> } | undefined };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.trip.findUnique.mockResolvedValue(trajet());
  prismaMock.trip.findUniqueOrThrow.mockResolvedValue(trajet({ status: "PUBLISHED" }));
  prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.carrierPage.findUnique.mockResolvedValue({ id: "cp1", totalTripsPublished: 3, totalTripsCancelled: 1 });
  prismaMock.carrierPage.updateMany.mockResolvedValue({ count: 1 });
  countActiveBookings.mockResolvedValue(0);
  hasActiveBookings.mockResolvedValue(false);
});

describe("A196 — l'écriture d'une transition est conditionnée à l'état lu", () => {
  it("mettre en pause : la condition rappelle le statut LU et « non supprimé »", async () => {
    const { res, error } = await appeler(pauseTrip);

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: { id: TRIP, status: "PUBLISHED", isDeleted: false },
      data: { status: "PAUSED" },
    });
    expect(prismaMock.trip.update).not.toHaveBeenCalled(); // plus aucune écriture inconditionnelle
  });

  it("le trajet a changé d'état entre la garde et l'écriture : 409 TRIP_STATE_CHANGED, jamais un 500", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 }); // l'autre onglet a écrit avant

    const { error } = await appeler(pauseTrip);

    expect(error).toMatchObject({ statusCode: 409, details: { type: "trip", code: "TRIP_STATE_CHANGED" } });
  });

  it("reprendre et archiver sont conditionnés de la même façon", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(trajet({ status: "PAUSED" }));
    await appeler(resumeTrip);
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TRIP, status: "PAUSED", isDeleted: false } }));

    jest.clearAllMocks();
    prismaMock.trip.findUnique.mockResolvedValue(trajet({ status: "CANCELLED" }));
    prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
    await appeler(archiveTrip);
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TRIP, status: "CANCELLED", isDeleted: false } }));
  });
});

/** Un brouillon qui passe TOUTES les gardes de publication (mode, route, date, prix, lieux, catégories). */
function brouillonPubliable(over: Record<string, unknown> = {}) {
  return trajet({
    status: "DRAFT",
    currentStep: 3,
    transportMode: "PLANE",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    acceptedCategories: ["DOCUMENTS"],
    categoryConditions: [{ category: "DOCUMENTS", priceAmountCents: 1500, priceMode: "FIXED" }],
    pickupLocations: [{ kind: "ADDRESS", label: "Gare de Lyon" }],
    deliveryLocations: [{ kind: "ADDRESS", label: "Aéroport de Maya-Maya" }],
    ...over,
  });
}

describe("A196 — publier deux fois", () => {
  it("le gagnant publie : compteur incrémenté une fois, notifications envoyées une fois", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(brouillonPubliable());

    const { error } = await appeler(publishTrip);

    expect(error).toBeUndefined();

    expect(prismaMock.carrierPage.updateMany).toHaveBeenCalledTimes(1);
    expect(triggerTripPublishedNotifications).toHaveBeenCalledTimes(1);
  });

  it("le perdant du double clic : 409, AUCUN compteur touché, AUCUNE seconde vague de notifications", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(brouillonPubliable());
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });

    const { error } = await appeler(publishTrip);

    expect(error).toMatchObject({ statusCode: 409, details: { code: "TRIP_STATE_CHANGED" } });
    expect(prismaMock.carrierPage.updateMany).not.toHaveBeenCalled();
    expect(triggerTripPublishedNotifications).not.toHaveBeenCalled();
  });
});

describe("A196 — annuler, et D72 qui doit tenir sous concurrence", () => {
  it("la condition porte AUSSI sur la réservation lue : un deal né entre-temps fait perdre la course", async () => {
    await appeler(cancelTrip);

    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: { id: TRIP, status: "PUBLISHED", isDeleted: false, reservedKg: 0 },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
  });

  it("un deal est né pendant la requête : 409 TRIP_HAS_ACTIVE_DEALS avec son décompte — pas « le trajet a changé »", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    countActiveBookings.mockResolvedValue(1);

    const { error } = await appeler(cancelTrip);

    expect(error).toMatchObject({ statusCode: 409, details: { type: "trip", code: "TRIP_HAS_ACTIVE_DEALS", activeDeals: 1 } });
    expect(prismaMock.carrierPage.updateMany).not.toHaveBeenCalled(); // aucun compteur pour un perdant
  });

  it("course perdue sans deal vivant (l'autre onglet a archivé) : 409 TRIP_STATE_CHANGED", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    countActiveBookings.mockResolvedValue(0);

    const { error } = await appeler(cancelTrip);

    expect(error).toMatchObject({ statusCode: 409, details: { code: "TRIP_STATE_CHANGED" } });
  });

  it("trajet d'avant B2-PR1 (`reservedKg` absent) : la condition l'omet plutôt que de refuser pour toujours", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(trajet({ reservedKg: null }));

    await appeler(cancelTrip);

    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TRIP, status: "PUBLISHED", isDeleted: false } }));
  });
});

describe("A196 — les compteurs publics du Voyageur", () => {
  it("l'écriture est conditionnée aux valeurs LUES", async () => {
    await appeler(cancelTrip);

    expect(prismaMock.carrierPage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cp1", totalTripsPublished: 3, totalTripsCancelled: 1 } })
    );
  });

  it("un autre geste est passé devant : on relit et on rejoue — le compte final est juste", async () => {
    prismaMock.carrierPage.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    prismaMock.carrierPage.findUnique
      .mockResolvedValueOnce({ id: "cp1", totalTripsPublished: 3, totalTripsCancelled: 1 })
      .mockResolvedValue({ id: "cp1", totalTripsPublished: 4, totalTripsCancelled: 1 }); // l'autre a publié

    await appeler(cancelTrip);

    expect(prismaMock.carrierPage.findUnique).toHaveBeenCalledTimes(2); // relu avant le second essai
    expect(prismaMock.carrierPage.updateMany).toHaveBeenCalledTimes(2);
  });

  it("trois échecs d'affilée : on renonce au compteur, jamais à la transition (elle est déjà écrite)", async () => {
    prismaMock.carrierPage.updateMany.mockResolvedValue({ count: 0 });

    const { res, error } = await appeler(cancelTrip);

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prismaMock.carrierPage.updateMany).toHaveBeenCalledTimes(3);
  });
});

export {};
