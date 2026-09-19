/**
 * search.api.ts — la recherche publique de trajets (lot recherche D36).
 * =====================================================================
 * MÊME endpoint que le web : `GET /trips/search` (gateway → trip-service),
 * mêmes paramètres, même page `{ trips, nextCursor, totalCount }`. Le serveur
 * fait tout (RG-MOB-1) : filtres durs, tri, textes localisés (`travelDate`
 * arrive déjà dans la langue de l'écran via `x-locale`), prix en EUROS dans
 * ce DTO (divisés par 100 par le mapper serveur), et il COMPTE la demande —
 * `recordSearch` (corridor + sans-résultat) est dans le contrôleur : une
 * recherche mobile pèse dans les stats exactement comme une recherche web.
 * La route est en authentification OPTIONNELLE : connecté, le Bearer part et
 * personnalise la réponse (favoris, langue du compte) ; visiteur, rien.
 */
import { apiFetch } from './client';

export type TripSearchResult = {
  id: string;
  fromCity: string;
  fromCountryCode?: string;
  toCity: string;
  toCountryCode?: string;
  /** Déjà localisée par le serveur (« 12 juin 2026 » / « June 12, 2026 »). */
  travelDate: string;
  departureTime: string;
  /** Absente quand le trajet n'a pas d'heure d'arrivée. */
  arrivalTime?: string;
  nextDay?: boolean;
  durationMinutes?: number;
  transportMode: 'plane' | 'train' | 'car';
  /** Euros — minimum des tarifs par catégorie (moteur legacy). */
  minPrice: number;
  /** Euros — moteur PER_KG (D13) ; null/absent = legacy. */
  pricePerKg?: number | null;
  /** Kilos encore disponibles (CAP-02). */
  remainingKg?: number | null;
  currency?: string;
  superTripper?: boolean;
  rating?: number;
  reviewCount?: number;
  travelerFirstName?: string;
  travelerAvatarUrl?: string;
};

export type SearchPage = {
  trips: TripSearchResult[];
  nextCursor: string | null;
  totalCount: number;
};

export type SearchParams = {
  from?: string;
  to?: string;
  /** ISO — bornes de la fenêtre de départ. */
  dateFrom?: string;
  dateTo?: string;
  cursor?: string | null;
  limit?: number;
};

export async function searchTrips(params: SearchParams): Promise<SearchPage> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<SearchPage>(`/trips/search${qs ? `?${qs}` : ''}`);
}
