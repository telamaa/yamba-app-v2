/**
 * saved-route-matching.helper.ts
 * ==============================
 * Calcule le score de match entre une SavedRoute et un Trip.
 *
 * Tiers de matching (le 1er qui match emporte le score) :
 *   Tier 1 — placeId exact match           → score 100
 *   Tier 2 — codes ISO + city normalisée   → score 100
 *   Tier 3 — countryCode + haversine <50km → score 70  (si includeNearby)
 *
 * Principes :
 *   - Cross-locale safe : on utilise SOIT le placeId SOIT les codes ISO.
 *     Le texte des villes (lui locale-dependent) n'est utilisé qu'en fallback
 *     avec normalisation, et toujours conditionné au countryCode.
 *   - Trips legacy (sans countryCode) : fallback gracieux via placeId / city name.
 *   - On ne retourne JAMAIS d'erreur ; en cas de data incomplète, le score est 0.
 *
 * Le caller doit ensuite filtrer :
 *   - score >= 70
 *   - si score < 100 ET !includeNearby → exclure
 *   - dates de la SavedRoute
 */

import { haversineKm, normalizeCityName, hasValidCoords } from "./geo.helper";

const NEARBY_RADIUS_KM = 50;

// Types loose pour permettre n'importe quelle "shape" de SavedRoute/Trip
type SavedRouteShape = {
  originCity: string;
  originCityCode: string | null;
  originCountryCode: string;
  originRegionCode?: string | null;
  originPlaceId: string | null;
  originLat: number | null;
  originLng: number | null;

  destinationCity: string;
  destinationCityCode: string | null;
  destinationCountryCode: string;
  destinationRegionCode?: string | null;
  destinationPlaceId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
};

type TripShape = {
  originCity: string | null;
  originCityCode: string | null;
  originCountryCode: string | null;
  originRegionCode?: string | null;
  originPlaceId: string | null;
  originLat: number | null;
  originLng: number | null;

  destinationCity: string | null;
  destinationCityCode: string | null;
  destinationCountryCode: string | null;
  destinationRegionCode?: string | null;
  destinationPlaceId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
};

/**
 * Calcule le score de match (0 / 70 / 100).
 */
export function calculateMatchScore(
  savedRoute: SavedRouteShape,
  trip: TripShape
): number {
  // ─── Tier 1 : placeId exact match (le plus fiable, cross-locale safe) ───
  if (
    savedRoute.originPlaceId &&
    trip.originPlaceId &&
    savedRoute.destinationPlaceId &&
    trip.destinationPlaceId &&
    savedRoute.originPlaceId === trip.originPlaceId &&
    savedRoute.destinationPlaceId === trip.destinationPlaceId
  ) {
    return 100;
  }

  // ─── Tier 2 : codes ISO + city normalisée ───
  const originExactMatch = isLocationExactMatch(
    {
      cityCode: savedRoute.originCityCode,
      countryCode: savedRoute.originCountryCode,
      city: savedRoute.originCity,
    },
    {
      cityCode: trip.originCityCode,
      countryCode: trip.originCountryCode,
      city: trip.originCity,
    }
  );

  const destinationExactMatch = isLocationExactMatch(
    {
      cityCode: savedRoute.destinationCityCode,
      countryCode: savedRoute.destinationCountryCode,
      city: savedRoute.destinationCity,
    },
    {
      cityCode: trip.destinationCityCode,
      countryCode: trip.destinationCountryCode,
      city: trip.destinationCity,
    }
  );

  if (originExactMatch && destinationExactMatch) {
    return 100;
  }

  // ─── Tier 3 : countryCode + haversine < 50km ───
  const originNearby = isLocationNearbyMatch(
    {
      countryCode: savedRoute.originCountryCode,
      lat: savedRoute.originLat,
      lng: savedRoute.originLng,
    },
    {
      countryCode: trip.originCountryCode,
      lat: trip.originLat,
      lng: trip.originLng,
    }
  );

  const destinationNearby = isLocationNearbyMatch(
    {
      countryCode: savedRoute.destinationCountryCode,
      lat: savedRoute.destinationLat,
      lng: savedRoute.destinationLng,
    },
    {
      countryCode: trip.destinationCountryCode,
      lat: trip.destinationLat,
      lng: trip.destinationLng,
    }
  );

  if (originNearby && destinationNearby) {
    return 70;
  }

  return 0;
}

/**
 * Vérifie si 2 locations sont "exactement" identiques.
 *
 * Stratégie (premier qui match) :
 *   1. cityCode IATA identique (le plus précis pour aéroports/gares)
 *   2. countryCode identique (si présent des 2 côtés) + city name normalisé identique
 *
 * Fallback gracieux : si countryCode manque d'un côté (trip legacy),
 * on compare quand même les city names normalisés.
 */
function isLocationExactMatch(
  saved: {
    cityCode: string | null;
    countryCode: string;
    city: string;
  },
  trip: {
    cityCode: string | null;
    countryCode: string | null;
    city: string | null;
  }
): boolean {
  // 1. cityCode IATA (le plus précis)
  if (saved.cityCode && trip.cityCode && saved.cityCode === trip.cityCode) {
    return true;
  }

  // 2. countryCode (si trip en a un, doit matcher) + city name
  // Si trip n'a PAS de countryCode (legacy), on accepte le match sur city name seul
  const countryMismatch =
    trip.countryCode !== null && saved.countryCode !== trip.countryCode;
  if (countryMismatch) {
    return false;
  }

  if (!trip.city) return false;
  return normalizeCityName(saved.city) === normalizeCityName(trip.city);
}

/**
 * Vérifie si 2 locations sont "proches" (< 50km).
 *
 * Conditions :
 *   - countryCode identique (si trip en a un)
 *   - haversine valide < 50km
 */
function isLocationNearbyMatch(
  saved: {
    countryCode: string;
    lat: number | null;
    lng: number | null;
  },
  trip: {
    countryCode: string | null;
    lat: number | null;
    lng: number | null;
  }
): boolean {
  // Coords nécessaires des 2 côtés
  if (!hasValidCoords(saved.lat, saved.lng)) return false;
  if (!hasValidCoords(trip.lat, trip.lng)) return false;

  // countryCode doit matcher si trip en a un
  if (trip.countryCode !== null && saved.countryCode !== trip.countryCode) {
    return false;
  }

  const distanceKm = haversineKm(saved.lat, saved.lng, trip.lat, trip.lng);
  return distanceKm < NEARBY_RADIUS_KM;
}

/**
 * Helper de debug : explique POURQUOI un match a abouti à ce score.
 * Utilisable depuis les logs/admin pour diagnostiquer.
 */
export function explainMatchScore(
  savedRoute: SavedRouteShape,
  trip: TripShape
): { score: number; reason: string } {
  const score = calculateMatchScore(savedRoute, trip);

  if (score === 100) {
    if (
      savedRoute.originPlaceId === trip.originPlaceId &&
      savedRoute.destinationPlaceId === trip.destinationPlaceId &&
      savedRoute.originPlaceId !== null
    ) {
      return { score, reason: "tier1: placeId exact match" };
    }
    return { score, reason: "tier2: ISO codes + city name match" };
  }

  if (score === 70) {
    return { score, reason: "tier3: countryCode + haversine < 50km" };
  }

  // Score 0 → diagnostiquer la raison
  const reasons: string[] = [];
  if (
    !savedRoute.originPlaceId ||
    !trip.originPlaceId ||
    savedRoute.originPlaceId !== trip.originPlaceId
  ) {
    reasons.push("placeId mismatch");
  }
  if (trip.originCountryCode && savedRoute.originCountryCode !== trip.originCountryCode) {
    reasons.push(
      `countryCode mismatch (saved=${savedRoute.originCountryCode}, trip=${trip.originCountryCode})`
    );
  }
  if (
    !hasValidCoords(savedRoute.originLat, savedRoute.originLng) ||
    !hasValidCoords(trip.originLat, trip.originLng)
  ) {
    reasons.push("missing coords");
  }

  return {
    score: 0,
    reason: reasons.length > 0 ? reasons.join(", ") : "no match",
  };
}
