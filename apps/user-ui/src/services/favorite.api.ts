/**
 * favorite.api.ts — favoris de trajets (D46)
 * POST/DELETE /trips/:id/favorite (idempotents) · GET /trips/favorites
 */
import apiClient from "@/lib/api-client";
import type { YambaTripResult } from "@/components/search/search-results.types";

export type TripFavoriteState = { tripId: string; isFavorite: boolean };
export type FavoriteTripsResponse = { trips: YambaTripResult[]; totalCount: number };

export async function addTripFavorite(tripId: string): Promise<TripFavoriteState> {
  const res = await apiClient.post<TripFavoriteState>(`/trips/${tripId}/favorite`, undefined, { requireAuth: true });
  return res.data;
}

export async function removeTripFavorite(tripId: string): Promise<TripFavoriteState> {
  const res = await apiClient.delete<TripFavoriteState>(`/trips/${tripId}/favorite`, { requireAuth: true });
  return res.data;
}

export async function listFavoriteTrips(locale: string): Promise<FavoriteTripsResponse> {
  const res = await apiClient.get<FavoriteTripsResponse>(`/trips/favorites`, {
    params: { locale },
    requireAuth: true,
  });
  return res.data;
}
