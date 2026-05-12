import { haversineKm } from "./geo.helper";

const NEARBY_RADIUS_KM = 50;

const SCORE_EXACT = 100;
const SCORE_NEARBY = 70;
const SCORE_NONE = 0;

/**
 * Normalise un nom de ville pour comparaison case-insensitive.
 */
export function normalizeCity(city: string | null | undefined): string {
  return (city ?? "").trim().toLowerCase();
}

type MatchableSavedRoute = {
  originCity: string;
  originPlaceId: string | null;
  originCountry: string;
  originLat: number | null;
  originLng: number | null;
  destinationCity: string;
  destinationPlaceId: string | null;
  destinationCountry: string;
  destinationLat: number | null;
  destinationLng: number | null;
};

type MatchableTrip = {
  originCity: string | null;
  originPlaceId: string | null;
  originCountry: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationCity: string | null;
  destinationPlaceId: string | null;
  destinationCountry: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
};

/**
 * Calcule un score de match entre une SavedRoute et un Trip.
 *
 * Score 100 : match parfait
 *   - Soit même placeId pour origine ET destination
 *   - Soit même nom de ville (case-insensitive) pour les 2
 *
 * Score 70 : match approximatif
 *   - Même pays + distance < 50 km pour origine ET destination
 *
 * Score 0 : pas de match
 */
export function calculateMatchScore(
  savedRoute: MatchableSavedRoute,
  trip: MatchableTrip
): number {
  // Bail si données manquantes
  if (!trip.originCity || !trip.destinationCity) return SCORE_NONE;

  // 1. Match par placeId (le plus fiable)
  if (
    savedRoute.originPlaceId &&
    trip.originPlaceId &&
    savedRoute.destinationPlaceId &&
    trip.destinationPlaceId &&
    savedRoute.originPlaceId === trip.originPlaceId &&
    savedRoute.destinationPlaceId === trip.destinationPlaceId
  ) {
    return SCORE_EXACT;
  }

  // 2. Match par nom de ville (normalisé)
  const originCityMatch =
    normalizeCity(savedRoute.originCity) === normalizeCity(trip.originCity);
  const destCityMatch =
    normalizeCity(savedRoute.destinationCity) ===
    normalizeCity(trip.destinationCity);

  if (originCityMatch && destCityMatch) {
    return SCORE_EXACT;
  }

  // 3. Match par proximité géographique (< 50 km)
  // Requires same country (basic safety) + coordinates on both sides
  const sameCountry =
    normalizeCity(savedRoute.originCountry) ===
    normalizeCity(trip.originCountry ?? "") &&
    normalizeCity(savedRoute.destinationCountry) ===
    normalizeCity(trip.destinationCountry ?? "");

  if (
    sameCountry &&
    savedRoute.originLat != null &&
    savedRoute.originLng != null &&
    trip.originLat != null &&
    trip.originLng != null &&
    savedRoute.destinationLat != null &&
    savedRoute.destinationLng != null &&
    trip.destinationLat != null &&
    trip.destinationLng != null
  ) {
    const originDistance = haversineKm(
      savedRoute.originLat,
      savedRoute.originLng,
      trip.originLat,
      trip.originLng
    );
    const destDistance = haversineKm(
      savedRoute.destinationLat,
      savedRoute.destinationLng,
      trip.destinationLat,
      trip.destinationLng
    );

    if (originDistance <= NEARBY_RADIUS_KM && destDistance <= NEARBY_RADIUS_KM) {
      return SCORE_NEARBY;
    }
  }

  return SCORE_NONE;
}

/**
 * Convertit un score en label exploitable côté email/UI.
 */
export function matchScoreToLabel(score: number): "exact" | "nearby" | "none" {
  if (score >= SCORE_EXACT) return "exact";
  if (score >= SCORE_NEARBY) return "nearby";
  return "none";
}

export const MATCH_SCORE_THRESHOLDS = {
  EXACT: SCORE_EXACT,
  NEARBY: SCORE_NEARBY,
};
