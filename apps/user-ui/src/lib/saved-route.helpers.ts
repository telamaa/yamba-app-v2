import type { SavedRoute, DateRangePreset } from "./saved-route.types";

/**
 * Formate l'intitulé d'une route : "Paris → Brazzaville"
 */
export function formatRouteLabel(savedRoute: SavedRoute): string {
  return `${savedRoute.originCity} → ${savedRoute.destinationCity}`;
}

/**
 * Formate l'intervalle de dates d'une alerte.
 * Si pas de dates → "Sans limite de date"
 * Si juste earliestDate → "À partir du 1 juin 2026"
 * Si juste latestDate → "Jusqu'au 31 août 2026"
 * Si les deux → "Du 1 juin au 31 août 2026"
 */
export function formatDateRange(
  earliestDate: string | null,
  latestDate: string | null,
  locale: "fr" | "en"
): string {
  if (!earliestDate && !latestDate) {
    return locale === "fr" ? "Sans limite de date" : "No date limit";
  }

  const formatShort = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  if (earliestDate && latestDate) {
    return locale === "fr"
      ? `Du ${formatShort(earliestDate)} au ${formatShort(latestDate)}`
      : `From ${formatShort(earliestDate)} to ${formatShort(latestDate)}`;
  }
  if (earliestDate) {
    return locale === "fr"
      ? `À partir du ${formatShort(earliestDate)}`
      : `From ${formatShort(earliestDate)}`;
  }
  return locale === "fr"
    ? `Jusqu'au ${formatShort(latestDate!)}`
    : `Until ${formatShort(latestDate!)}`;
}

/**
 * Indique si une alerte est expirée (compare expiresAt à maintenant).
 */
export function isExpired(savedRoute: SavedRoute): boolean {
  return new Date(savedRoute.expiresAt) < new Date();
}

/**
 * Indique si une alerte expire dans les N jours.
 */
export function expiresWithinDays(savedRoute: SavedRoute, days: number): boolean {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return new Date(savedRoute.expiresAt) < threshold;
}

/**
 * Formate "Expire dans X jours / mois".
 */
export function formatExpiresIn(
  expiresAt: string,
  locale: "fr" | "en"
): string {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diffMs = exp.getTime() - now.getTime();

  if (diffMs < 0) {
    return locale === "fr" ? "Expirée" : "Expired";
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return locale === "fr"
      ? `Expire dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`
      : `Expires in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }
  if (diffDays <= 60) {
    return locale === "fr"
      ? `Expire dans ${diffDays} jours`
      : `Expires in ${diffDays} days`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return locale === "fr"
    ? `Expire dans ${diffMonths} mois`
    : `Expires in ${diffMonths} months`;
}

/**
 * Applique un preset de période et retourne (earliestDate, latestDate).
 * Tous les presets démarrent à demain pour laisser le user le temps.
 */
export function applyDateRangePreset(
  preset: DateRangePreset
): { earliestDate: string | null; latestDate: string | null } {
  if (preset === "unlimited") {
    return { earliestDate: null, latestDate: null };
  }
  if (preset === "custom") {
    return { earliestDate: null, latestDate: null };
  }

  const months = preset === "3months" ? 3 : 6;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const later = new Date(tomorrow);
  later.setMonth(later.getMonth() + months);

  return {
    earliestDate: tomorrow.toISOString(),
    latestDate: later.toISOString(),
  };
}

/**
 * Détecte le preset utilisé à partir de earliestDate + latestDate.
 * Utile pour pré-sélectionner le preset à l'ouverture d'un edit modal.
 */
export function detectPreset(
  earliestDate: string | null,
  latestDate: string | null
): DateRangePreset {
  if (!earliestDate && !latestDate) return "unlimited";
  if (!earliestDate || !latestDate) return "custom";

  const earliest = new Date(earliestDate);
  const latest = new Date(latestDate);
  const diffMs = latest.getTime() - earliest.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Tolérance de quelques jours pour matcher les presets
  if (diffDays >= 80 && diffDays <= 100) return "3months";
  if (diffDays >= 170 && diffDays <= 195) return "6months";
  return "custom";
}
