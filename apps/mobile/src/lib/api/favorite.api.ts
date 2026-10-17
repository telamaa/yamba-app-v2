/**
 * favorite.api.ts — la couche API de l'onglet « Favoris » (A210)
 * ==============================================================
 * L'onglet regroupe TROIS objets de la même famille, servis par trois
 * endpoints qui existaient DÉJÀ (aucun endpoint mobile — A204/A205) :
 *   • Trajets   → `GET /trips/favorites`  (trip-service, D46)
 *   • Souhaits  → `GET /saved-routes`     (auth-service, alertes de route)
 *   • Voyageurs → `GET /me/following`     (auth-service, abonnements)
 *
 * `GET /trips/favorites` rend le MÊME DTO que la recherche
 * (`YambaTripResultDto`) : la carte de résultat se réutilise telle quelle,
 * aucun composant d'affichage en double.
 *
 * Membre uniquement — le Bearer part par défaut (`requireAuth` d'apiFetch) ;
 * le serveur reste seul juge des refus via `details.code`.
 */
import { apiFetch } from './client';
import type { TripSearchResult } from './search.api';

export type TripFavoriteState = { tripId: string; isFavorite: boolean };

export function addTripFavorite(tripId: string): Promise<TripFavoriteState> {
  return apiFetch<TripFavoriteState>(`/trips/${tripId}/favorite`, { method: 'POST' });
}

export function removeTripFavorite(tripId: string): Promise<TripFavoriteState> {
  return apiFetch<TripFavoriteState>(`/trips/${tripId}/favorite`, { method: 'DELETE' });
}

// ─── Segment « Trajets » ────────────────────────────────────────────────
/** Les trajets mis de côté. Un favori SURVIT à la fin du trajet (D46) : le
 *  tri serveur est le plus récent d'abord, l'écran sépare actifs et passés. */
export function listFavoriteTrips(): Promise<{ trips: TripSearchResult[]; totalCount: number }> {
  return apiFetch<{ trips: TripSearchResult[]; totalCount: number }>('/trips/favorites');
}

// ─── Segment « Souhaits » ───────────────────────────────────────────────
/** Une alerte de route : « préviens-moi quand quelqu'un part d'ici vers là ». */
export type SavedRoute = {
  id: string;
  originCity: string;
  originCountryCode: string;
  destinationCity: string;
  destinationCountryCode: string;
  earliestDate: string | null;
  latestDate: string | null;
  includeNearby: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
};

export async function listSavedRoutes(): Promise<SavedRoute[]> {
  const page = await apiFetch<{ savedRoutes: SavedRoute[] }>('/saved-routes');
  return page.savedRoutes ?? [];
}

// ─── Segment « Voyageurs » ──────────────────────────────────────────────
export type FollowedCarrier = {
  user: {
    id: string;
    publicSlug: string;
    firstName: string;
    lastInitial: string;
    avatarUrl: string | null;
    carrierRatingAvg: number | null;
    carrierRatingCount: number;
    totalTripsPublished: number;
  };
  nextTrip: {
    id: string;
    originCity: string;
    destinationCity: string;
    departureAt: string;
  } | null;
  followedAt: string;
  notifyNextTrip: boolean;
};

export async function listMyFollowing(): Promise<FollowedCarrier[]> {
  const page = await apiFetch<{ following: FollowedCarrier[] }>('/me/following');
  return page.following ?? [];
}
