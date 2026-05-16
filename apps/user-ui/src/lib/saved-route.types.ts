/**
 * Types matching the SavedRoute DTO returned by the API.
 *
 * Source de vérité :
 *   apps/auth-service/src/controller/saved-route.controller.ts
 */

export type SavedRoute = {
  id: string;
  userId: string;

  // Origin
  originCity: string;
  originCityCode: string | null;       // ✨ NEW — IATA si dispo
  originCountry: string;
  originCountryCode: string;           // ISO 3166-1 alpha-2
  originRegion: string | null;         // ✨ NEW — affichable
  originRegionCode: string | null;     // ✨ NEW — ISO 3166-2
  originPlaceId: string | null;
  originLat: number | null;
  originLng: number | null;

  // Destination
  destinationCity: string;
  destinationCityCode: string | null;       // ✨ NEW
  destinationCountry: string;
  destinationCountryCode: string;
  destinationRegion: string | null;         // ✨ NEW
  destinationRegionCode: string | null;     // ✨ NEW
  destinationPlaceId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;

  // Dates
  earliestDate: string | null;
  latestDate: string | null;

  // Préférences
  emailEnabled: boolean;
  inAppEnabled: boolean;
  includeNearby: boolean;

  // Cycle de vie
  expiresAt: string;
  expiryWarningSentAt: string | null;
  isActive: boolean;

  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Payloads de mutation ────────────────────────────────

export type CreateSavedRoutePayload = {
  // Origin
  originCity: string;
  originCityCode?: string | null;       // ✨ NEW
  originCountry: string;
  originCountryCode: string;
  originRegion?: string | null;         // ✨ NEW
  originRegionCode?: string | null;     // ✨ NEW
  originPlaceId?: string | null;
  originLat?: number | null;
  originLng?: number | null;

  // Destination
  destinationCity: string;
  destinationCityCode?: string | null;       // ✨ NEW
  destinationCountry: string;
  destinationCountryCode: string;
  destinationRegion?: string | null;         // ✨ NEW
  destinationRegionCode?: string | null;     // ✨ NEW
  destinationPlaceId?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;

  earliestDate?: string | null;
  latestDate?: string | null;

  emailEnabled?: boolean;
  includeNearby?: boolean;
};

export type UpdateSavedRoutePayload = {
  earliestDate?: string | null;
  latestDate?: string | null;
  emailEnabled?: boolean;
  includeNearby?: boolean;
};

export type DateRangePreset = "3months" | "6months" | "unlimited" | "custom";
