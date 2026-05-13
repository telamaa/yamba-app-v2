/**
 * Helpers pour les SavedRoute.
 */

const DEFAULT_TTL_MONTHS = 6;

/**
 * Normalise un nom de ville pour comparaison case-insensitive.
 * "Paris " → "paris"
 * "Saint-Étienne" → "saint-étienne"
 */
export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Calcule la date d'expiration d'une SavedRoute.
 *
 * Règles :
 *   - Si latestDate fournie → expiresAt = latestDate + 1 jour (00:00 UTC le jour suivant)
 *   - Sinon → expiresAt = now() + 6 mois
 */
export function computeExpiresAt(latestDate: Date | null | undefined): Date {
  if (latestDate) {
    const expiresAt = new Date(latestDate);
    expiresAt.setDate(expiresAt.getDate() + 1);
    expiresAt.setUTCHours(0, 0, 0, 0);
    return expiresAt;
  }

  // Pas de date limite → expiration auto 6 mois
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + DEFAULT_TTL_MONTHS);
  return expiresAt;
}

/**
 * Calcule l'extension d'une SavedRoute lors d'un /extend.
 * Ajoute 6 mois à partir de maintenant (peu importe latestDate).
 */
export function computeExtendedExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + DEFAULT_TTL_MONTHS);
  return expiresAt;
}

/**
 * Validation du payload de création/update.
 * Retourne un objet d'erreurs (vide si tout OK).
 */
export function validateSavedRoutePayload(input: {
  originCity?: string;
  originCountry?: string;
  originCountryCode?: string;
  destinationCity?: string;
  destinationCountry?: string;
  destinationCountryCode?: string;
  earliestDate?: string | null;
  latestDate?: string | null;
}): string | null {
  if (!input.originCity?.trim()) return "Origin city is required.";
  if (!input.originCountry?.trim()) return "Origin country is required.";
  if (!input.originCountryCode?.trim()) return "Origin country code is required.";
  if (input.originCountryCode.length !== 2) {
    return "Origin country code must be ISO 2 letters.";
  }

  if (!input.destinationCity?.trim()) return "Destination city is required.";
  if (!input.destinationCountry?.trim()) return "Destination country is required.";
  if (!input.destinationCountryCode?.trim()) {
    return "Destination country code is required.";
  }
  if (input.destinationCountryCode.length !== 2) {
    return "Destination country code must be ISO 2 letters.";
  }

  // Validation : origin et destination doivent être différentes
  if (
    normalizeCity(input.originCity) === normalizeCity(input.destinationCity) &&
    input.originCountryCode.toUpperCase() ===
    input.destinationCountryCode.toUpperCase()
  ) {
    return "Origin and destination must be different.";
  }

  // Validation des dates
  if (input.earliestDate && input.latestDate) {
    const earliest = new Date(input.earliestDate);
    const latest = new Date(input.latestDate);
    if (earliest > latest) {
      return "Earliest date must be before latest date.";
    }
  }

  // Validation : earliestDate ne doit pas être dans le passé (> 24h)
  if (input.earliestDate) {
    const earliest = new Date(input.earliestDate);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (earliest < oneDayAgo) {
      return "Earliest date cannot be in the past.";
    }
  }

  return null;
}
