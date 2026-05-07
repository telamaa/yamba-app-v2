/**
 * Helpers de formatage de dates avec gestion explicite des fuseaux horaires.
 *
 * ⚠️ Pourquoi pas juste `toISOString()` côté serveur ?
 * Parce qu'un trajet Paris → Pointe-Noire part à 08:00 LOCAL Paris (CEST/UTC+2)
 * et arrive à 14:30 LOCAL Pointe-Noire (WAT/UTC+1). Sans TZ explicite, on
 * affiche n'importe quoi côté client. On formate donc TOUJOURS dans la TZ de
 * l'aéroport correspondant.
 */

const FALLBACK_TZ = "Europe/Paris";

export type SupportedLocale = "fr" | "en";

/**
 * Formate une date en une chaîne de date locale-aware.
 * @example formatTripDate(d, "Europe/Paris", "fr") → "12 juin 2026"
 * @example formatTripDate(d, "Europe/Paris", "en") → "June 12, 2026"
 */
export function formatTripDate(
  date: Date,
  tz: string | null | undefined,
  locale: SupportedLocale = "fr"
): string {
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(localeTag, {
    timeZone: tz || FALLBACK_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Formate une heure en HH:mm dans la TZ donnée.
 * Toujours en 24h, peu importe la locale (cohérence avec le mock UI).
 * @example formatTripTime(d, "Europe/Paris") → "08:00"
 */
export function formatTripTime(
  date: Date,
  tz: string | null | undefined
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || FALLBACK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Retourne le numéro du jour du mois (1-31) dans une TZ donnée.
 * Utilisé pour détecter si l'arrivée est sur un jour différent du départ.
 */
function getDayOfMonth(date: Date, tz: string | null | undefined): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || FALLBACK_TZ,
    day: "numeric",
  }).format(date);
  return parseInt(formatted, 10);
}

/**
 * True si le trajet arrive un jour calendaire différent du départ
 * (en tenant compte des TZ des deux extrémités).
 *
 * Exemple : départ Paris 22:15 → arrivée Kinshasa 07:00 le lendemain
 * → true → la UI affiche "+1" en exposant.
 */
export function isNextDay(
  departureAt: Date,
  arrivalAt: Date,
  originTZ: string | null | undefined,
  destTZ: string | null | undefined
): boolean {
  if (arrivalAt <= departureAt) return false;
  const depDay = getDayOfMonth(departureAt, originTZ);
  const arrDay = getDayOfMonth(arrivalAt, destTZ);
  return depDay !== arrDay;
}

/**
 * Calcule l'heure locale (0-23) d'une date dans une TZ donnée.
 * Utilisé au create d'un trip pour pré-calculer departureHourLocal,
 * qui sert ensuite au filtre "matin/aprem/soir" sans recalcul TZ par requête.
 */
export function computeHourLocal(
  date: Date,
  tz: string | null | undefined
): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || FALLBACK_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // Intl peut retourner "24" pour minuit dans certaines locales/runtimes ; on normalise.
  const hour = parseInt(formatted, 10);
  return hour === 24 ? 0 : hour;
}
