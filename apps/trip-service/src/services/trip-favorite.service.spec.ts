const prismaMock = {
  trip: { findUnique: jest.fn() },
  tripFavorite: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { AppError, ForbiddenError, NotFoundError } from "@packages/error-handler";
import { addFavorite, favoriteTripIds, markFavorites, removeFavorite } from "./trip-favorite.service";

const USER = "64b000000000000000000001";
const OWNER = "64b000000000000000000002";
const TRIP = "64b0000000000000000000aa";

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.trip.findUnique.mockResolvedValue({ id: TRIP, userId: OWNER, status: "PUBLISHED", isDeleted: false });
  prismaMock.tripFavorite.upsert.mockResolvedValue({});
  prismaMock.tripFavorite.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.tripFavorite.findMany.mockResolvedValue([]);
});

describe("favoris de trajets (D46, A59) — règles serveur", () => {
  it("ajoute un favori sur un trajet publié d'un autre utilisateur (upsert idempotent)", async () => {
    await expect(addFavorite(USER, TRIP)).resolves.toEqual({ tripId: TRIP, isFavorite: true });
    await expect(addFavorite(USER, TRIP)).resolves.toEqual({ tripId: TRIP, isFavorite: true });
    expect(prismaMock.tripFavorite.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.tripFavorite.upsert.mock.calls[0][0].where).toEqual({ userId_tripId: { userId: USER, tripId: TRIP } });
  });

  it("trajet inexistant ou supprimé → 404 (jamais 403)", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);
    await expect(addFavorite(USER, TRIP)).rejects.toBeInstanceOf(NotFoundError);
    prismaMock.trip.findUnique.mockResolvedValue({ id: TRIP, userId: OWNER, status: "PUBLISHED", isDeleted: true });
    await expect(removeFavorite(USER, TRIP)).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.tripFavorite.upsert).not.toHaveBeenCalled();
  });

  it("son propre trajet → 403 OWN_TRIP", async () => {
    await expect(addFavorite(OWNER, TRIP)).rejects.toMatchObject({
      statusCode: 403,
      details: { type: "favorite", code: "OWN_TRIP", tripId: TRIP },
    });
    await expect(addFavorite(OWNER, TRIP)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["DRAFT", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"])("trajet %s → 409 TRIP_NOT_FAVORITABLE à l'ajout", async (status) => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: TRIP, userId: OWNER, status, isDeleted: false });
    const err = await addFavorite(USER, TRIP).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
    expect(err.details).toEqual({ type: "favorite", code: "TRIP_NOT_FAVORITABLE", tripId: TRIP });
  });

  it("le retrait est toujours possible, même sur un trajet passé (idempotent)", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: TRIP, userId: OWNER, status: "COMPLETED", isDeleted: false });
    await expect(removeFavorite(USER, TRIP)).resolves.toEqual({ tripId: TRIP, isFavorite: false });
    prismaMock.tripFavorite.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeFavorite(USER, TRIP)).resolves.toEqual({ tripId: TRIP, isFavorite: false });
  });

  it("markFavorites : visiteur → false partout sans requête ; connecté → true sur ses favoris", async () => {
    const items = [{ id: "a" }, { id: "b" }] as Array<{ id: string; isFavorite?: boolean }>;
    await markFavorites(undefined, items);
    expect(items.map((i) => i.isFavorite)).toEqual([false, false]);
    expect(prismaMock.tripFavorite.findMany).not.toHaveBeenCalled();

    prismaMock.tripFavorite.findMany.mockResolvedValue([{ tripId: "b" }]);
    await markFavorites(USER, items);
    expect(items.map((i) => i.isFavorite)).toEqual([false, true]);
    expect(prismaMock.tripFavorite.findMany.mock.calls[0][0].where).toEqual({ userId: USER, tripId: { in: ["a", "b"] } });
  });

  it("favoriteTripIds : liste vide → aucune requête", async () => {
    expect(await favoriteTripIds(USER, [])).toEqual(new Set());
    expect(prismaMock.tripFavorite.findMany).not.toHaveBeenCalled();
  });
});
