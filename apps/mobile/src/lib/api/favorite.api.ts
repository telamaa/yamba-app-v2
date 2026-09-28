/**
 * favorite.api.ts — favoris de trajets (D46), miroir du web
 * =========================================================
 * MÊMES endpoints que `apps/user-ui/src/services/favorite.api.ts` :
 * POST/DELETE `/trips/:id/favorite` (idempotents). Membre uniquement — le
 * Bearer part par défaut (`requireAuth` d'apiFetch) ; le serveur reste seul
 * juge des refus (propre trajet, trajet non publié) via `details.code`.
 */
import { apiFetch } from './client';

export type TripFavoriteState = { tripId: string; isFavorite: boolean };

export function addTripFavorite(tripId: string): Promise<TripFavoriteState> {
  return apiFetch<TripFavoriteState>(`/trips/${tripId}/favorite`, { method: 'POST' });
}

export function removeTripFavorite(tripId: string): Promise<TripFavoriteState> {
  return apiFetch<TripFavoriteState>(`/trips/${tripId}/favorite`, { method: 'DELETE' });
}
