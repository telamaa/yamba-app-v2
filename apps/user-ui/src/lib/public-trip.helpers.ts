/**
 * Helpers pour la page détail publique d'un trip
 */

import type { TransportMode, TripDates, PublicTrip } from "./public-trip.types";

// ─────────────────────────────────────────────────────────────────
// Distance Haversine (km)
// ─────────────────────────────────────────────────────────────────

export function calculateDistanceKm(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ─────────────────────────────────────────────────────────────────
// CO₂ évités (vs. fret express)
// ─────────────────────────────────────────────────────────────────

const FREIGHT_EMISSION_G_PER_KG_PER_KM: Record<TransportMode, number> = {
  PLANE: 600,
  TRAIN: 30,
  CAR: 80,
};

export function calculateCO2SavedKg(trip: PublicTrip): number | null {
  if (!trip.transportMode) return null;

  const distanceKm = calculateDistanceKm(
    trip.origin.lat,
    trip.origin.lng,
    trip.destination.lat,
    trip.destination.lng
  );

  if (distanceKm == null) return null;

  const emissionGramPerKm = FREIGHT_EMISSION_G_PER_KG_PER_KM[trip.transportMode];
  const co2Grams = emissionGramPerKm * distanceKm;
  return co2Grams / 1000;
}

// ─────────────────────────────────────────────────────────────────
// Durée du trajet
// ─────────────────────────────────────────────────────────────────

export function formatTripDuration(dates: TripDates): string | null {
  if (!dates.departureAt || !dates.arrivalAt) return null;

  const depMs = new Date(dates.departureAt).getTime();
  const arrMs = new Date(dates.arrivalAt).getTime();
  const diffMin = Math.round((arrMs - depMs) / 60000);

  if (diffMin < 0) return null;

  const days = Math.floor(diffMin / (60 * 24));
  const hours = Math.floor((diffMin % (60 * 24)) / 60);
  const minutes = diffMin % 60;

  if (days > 0) {
    return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
  }
  return `${minutes}min`;
}

// ─────────────────────────────────────────────────────────────────
// Prix
// ─────────────────────────────────────────────────────────────────

export function formatPrice(
  cents: number | null | undefined,
  currency = "EUR",
  locale: "fr" | "en" = "fr"
): string {
  if (cents == null) return "-";
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatPriceShort(
  cents: number | null | undefined,
  currency = "EUR",
  locale: "fr" | "en" = "fr"
): string {
  if (cents == null) return "-";
  const value = cents / 100;
  const isInteger = value === Math.floor(value);
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(isInteger ? 0 : 2)} ${currency}`;
  }
}

/**
 * Récupère le prix minimum du trip.
 * Priorité au champ dénormalisé `minPriceCents` du DTO (calculé côté backend
 * au moment du publish). Fallback sur un calcul côté client si absent.
 */
export function getMinPriceCents(trip: PublicTrip): number | null {
  if (trip.minPriceCents != null && trip.minPriceCents > 0) {
    return trip.minPriceCents;
  }
  if (!trip.categoryConditions || trip.categoryConditions.length === 0) {
    return null;
  }
  const prices = trip.categoryConditions
    .map((c) => c.priceAmountCents)
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

// ─────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────

const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FR_DAYS = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi",
];

const EN_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function formatLongDate(
  iso: string | null,
  locale: "fr" | "en" = "fr"
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  const day = d.getDate();
  const month = locale === "fr" ? FR_MONTHS[d.getMonth()] : EN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const weekday = locale === "fr" ? FR_DAYS[d.getDay()] : EN_DAYS[d.getDay()];

  return locale === "fr"
    ? `${weekday} ${day} ${month} ${year}`
    : `${weekday} ${month} ${day}, ${year}`;
}

export function formatShortDate(
  iso: string | null,
  locale: "fr" | "en" = "fr"
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  const day = d.getDate();
  const month = locale === "fr" ? FR_MONTHS[d.getMonth()] : EN_MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return locale === "fr" ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}

export function formatLocalTime(
  iso: string | null,
  fallbackTimeLocal: string | null
): string {
  if (fallbackTimeLocal) return fallbackTimeLocal;
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function getInitials(firstName: string, lastInitial: string): string {
  const first = firstName?.charAt(0).toUpperCase() ?? "";
  return `${first}${lastInitial}`.trim() || "?";
}

export function formatMemberSince(
  iso: string | null,
  locale: "fr" | "en" = "fr"
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const month = locale === "fr" ? FR_MONTHS[d.getMonth()] : EN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${month} ${year}`;
}
