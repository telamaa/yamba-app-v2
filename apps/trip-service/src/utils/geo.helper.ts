/**
 * Helpers géographiques pour le matching de routes.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calcule la distance entre 2 points GPS en kilomètres.
 * Formule de Haversine.
 *
 * @param lat1 Latitude du point 1
 * @param lng1 Longitude du point 1
 * @param lat2 Latitude du point 2
 * @param lng2 Longitude du point 2
 * @returns Distance en km, arrondie à 2 décimales
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Vérifie si 2 points GPS sont dans un rayon donné.
 */
export function isWithinRadius(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  maxKm: number
): boolean {
  return haversineKm(lat1, lng1, lat2, lng2) <= maxKm;
}

/**
 * Normalise un nom de ville pour comparaison case-insensitive et accent-insensitive.
 *
 *   normalizeCityName("São Paulo")  → "sao paulo"
 *   normalizeCityName("PRAGUE")     → "prague"
 *   normalizeCityName("  Lyon  ")   → "lyon"
 *
 * Cas limite : ne gère pas les transliterations (ex: "Praha" ≠ "Prague").
 * Pour ça, utiliser le placeId qui est universel.
 */
export function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Type guard : vérifie qu'une paire (lat, lng) est valide.
 * Empêche les bugs si la BDD contient des coords null/invalides.
 */
export function hasValidCoords(
  lat: number | null | undefined,
  lng: number | null | undefined
): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
