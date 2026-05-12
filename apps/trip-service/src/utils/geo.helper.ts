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
