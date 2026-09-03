/**
 * trip-favorite.service.ts — favoris de trajets (D46, A59)
 * ========================================================
 * Un favori est un signet PRIVÉ : il n'informe jamais le Voyageur, n'est
 * jamais compté publiquement, et survit à la fin du trajet (la liste le
 * montre comme « passé »). Règles serveur (le front ne décide jamais — D4) :
 *  - trajet inexistant ou supprimé → 404 (jamais 403 : ne pas révéler)
 *  - son propre trajet → 403 OWN_TRIP
 *  - trajet non PUBLISHED → 409 TRIP_NOT_FAVORITABLE (ajout seulement ;
 *    le retrait est toujours possible)
 *  - ajout et retrait IDEMPOTENTS : rejouer la même action = même état 200
 */
import prisma from "@packages/libs/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@packages/error-handler";
import type { TripFavoriteErrorCode, TripFavoriteState } from "@packages/api-contracts";
import { TRIP_SEARCH_INCLUDE, mapTripToYambaResult, type YambaTripResultDto } from "../lib/trip-mappers";

type FavoriteErrorDetails = { type: "favorite"; code: TripFavoriteErrorCode; tripId: string };

function favoriteError(status: 403 | 409, code: TripFavoriteErrorCode, tripId: string, message: string) {
  const details: FavoriteErrorDetails = { type: "favorite", code, tripId };
  return status === 403
    ? Object.assign(new ForbiddenError(message), { details })
    : new AppError(message, 409, true, details);
}

async function loadTripForFavorite(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true, status: true, isDeleted: true },
  });
  if (!trip || trip.isDeleted) throw new NotFoundError("Trip not found.");
  return trip;
}

export async function addFavorite(userId: string, tripId: string): Promise<TripFavoriteState> {
  const trip = await loadTripForFavorite(tripId);
  if (trip.userId === userId) {
    throw favoriteError(403, "OWN_TRIP", tripId, "You cannot favorite your own trip.");
  }
  if (trip.status !== "PUBLISHED") {
    throw favoriteError(409, "TRIP_NOT_FAVORITABLE", tripId, "Only published trips can be favorited.");
  }
  // Idempotent : la contrainte unique (userId, tripId) rend l'upsert sûr en concurrence.
  await prisma.tripFavorite.upsert({
    where: { userId_tripId: { userId, tripId } },
    create: { userId, tripId },
    update: {},
  });
  return { tripId, isFavorite: true };
}

export async function removeFavorite(userId: string, tripId: string): Promise<TripFavoriteState> {
  await loadTripForFavorite(tripId);
  await prisma.tripFavorite.deleteMany({ where: { userId, tripId } });
  return { tripId, isFavorite: false };
}

/** Ids favoris de l'utilisateur parmi `tripIds` (vide pour un visiteur). */
export async function favoriteTripIds(userId: string | undefined, tripIds: string[]): Promise<Set<string>> {
  if (!userId || tripIds.length === 0) return new Set();
  const rows = await prisma.tripFavorite.findMany({
    where: { userId, tripId: { in: tripIds } },
    select: { tripId: true },
  });
  return new Set(rows.map((r) => r.tripId));
}

/** Pose `isFavorite` sur des cartes de recherche (visiteur → false partout). */
export async function markFavorites<T extends { id: string; isFavorite?: boolean }>(
  userId: string | undefined,
  items: T[]
): Promise<T[]> {
  const ids = await favoriteTripIds(userId, items.map((i) => i.id));
  for (const item of items) item.isFavorite = ids.has(item.id);
  return items;
}

/** Mes favoris : cartes de recherche, du plus récent au plus ancien, trajets passés inclus. */
export async function listFavoriteTrips(userId: string, locale: "fr" | "en"): Promise<{ trips: YambaTripResultDto[]; totalCount: number }> {
  const rows = await prisma.tripFavorite.findMany({
    where: { userId, trip: { isDeleted: false } },
    orderBy: { createdAt: "desc" },
    include: { trip: { include: TRIP_SEARCH_INCLUDE } },
  });
  const trips: YambaTripResultDto[] = [];
  for (const row of rows) {
    try {
      const dto = mapTripToYambaResult(row.trip as any, locale);
      dto.isFavorite = true;
      trips.push(dto);
    } catch (err) {
      console.warn(`[favorites] Skipping invalid trip ${row.tripId}: ${(err as Error).message}`);
    }
  }
  return { trips, totalCount: trips.length };
}
