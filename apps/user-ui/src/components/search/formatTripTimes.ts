/**
 * Utilitaires pour formater les horaires et dates de trajet.
 *
 * Gère:
 *  - Le calcul automatique de la durée si absente (departureTime + arrivalTime)
 *  - La détection du "jour suivant" (arrivalTime < departureTime)
 *  - Le formatage "6H 30" / "1H 20"
 *  - Le formatage de date FR/EN avec respect de la locale active
 */

export type TripTimes = {
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
};

export type FormattedTimes = {
  /** Heure de départ ("08:00" ou undefined) */
  departure: string | null;
  /** Heure d'arrivée ("14:30" ou undefined) */
  arrival: string | null;
  /** Durée formatée ("6H 30" ou undefined) */
  duration: string | null;
  /** True si l'arrivée est le jour suivant */
  nextDay: boolean;
  /** True si on a au moins une heure à afficher */
  hasTimes: boolean;
};

/**
 * Parse "HH:MM" en nombre de minutes depuis minuit.
 * Retourne null si invalide.
 */
function parseTimeToMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * Formate une durée en minutes en "6H 30" / "1H 05".
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}H`;
  return `${hours}H ${mins.toString().padStart(2, "0")}`;
}

/**
 * Calcule automatiquement la durée entre departureTime et arrivalTime.
 * Gère le cas "jour suivant" (ex: 22:00 → 06:30 = 8h30).
 */
function computeDurationMinutes(
  departureTime: string,
  arrivalTime: string
): number {
  const depMin = parseTimeToMinutes(departureTime);
  const arrMin = parseTimeToMinutes(arrivalTime);

  if (depMin === null || arrMin === null) return 0;

  // Si l'arrivée est avant le départ (en minutes), on ajoute 24h
  const diff = arrMin < depMin ? arrMin + 24 * 60 - depMin : arrMin - depMin;

  return diff;
}

/**
 * Détecte si l'arrivée est le jour suivant (heure d'arrivée < heure de départ).
 */
function isNextDay(departureTime: string, arrivalTime: string): boolean {
  const depMin = parseTimeToMinutes(departureTime);
  const arrMin = parseTimeToMinutes(arrivalTime);

  if (depMin === null || arrMin === null) return false;

  return arrMin < depMin;
}

/**
 * Formate les horaires d'un trajet à afficher sur la card.
 *
 * @example
 * formatTripTimes({ departureTime: "08:00", arrivalTime: "14:30" })
 * // → { departure: "08:00", arrival: "14:30", duration: "6H 30", nextDay: false, hasTimes: true }
 *
 * formatTripTimes({ departureTime: "22:15", arrivalTime: "06:30" })
 * // → { departure: "22:15", arrival: "06:30", duration: "8H 15", nextDay: true, hasTimes: true }
 *
 * formatTripTimes({})
 * // → { departure: null, arrival: null, duration: null, nextDay: false, hasTimes: false }
 */
export function formatTripTimes(times: TripTimes): FormattedTimes {
  const { departureTime, arrivalTime, durationMinutes } = times;

  // Durée : priorité à la valeur explicite, sinon calcul auto si les 2 heures sont là
  let durationMins: number | null = null;
  if (typeof durationMinutes === "number" && durationMinutes > 0) {
    durationMins = durationMinutes;
  } else if (departureTime && arrivalTime) {
    durationMins = computeDurationMinutes(departureTime, arrivalTime);
  }

  const nextDay =
    departureTime && arrivalTime ? isNextDay(departureTime, arrivalTime) : false;

  return {
    departure: departureTime ?? null,
    arrival: arrivalTime ?? null,
    duration: durationMins && durationMins > 0 ? formatDurationMinutes(durationMins) : null,
    nextDay,
    hasTimes: !!(departureTime || arrivalTime),
  };
}

/**
 * Formate l'emplacement (code + pays) pour affichage compact.
 *
 * @example
 * formatLocation("CDG", "France") // "CDG · France"
 * formatLocation("CDG", undefined) // "CDG"
 * formatLocation(undefined, "France") // "France"
 * formatLocation(undefined, undefined) // null
 */
export function formatLocation(
  code: string | undefined,
  country: string | undefined
): string | null {
  if (code && country) return `${code} · ${country}`;
  if (code) return code;
  if (country) return country;
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Date formatting
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mapping des noms de mois FR (avec et sans accent) vers leur index 0-11.
 * Sert à parser les dates stockées en dur dans les mocks (ex: "12 juin 2026").
 */
const MONTHS_FR_INDEX: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

/**
 * Parse une date string FR au format "DD mois YYYY" en objet Date.
 * Retourne null si le format n'est pas reconnu.
 *
 * @example
 * parseFrenchDate("12 juin 2026") // → new Date(2026, 5, 12)
 * parseFrenchDate("01 août 2026") // → new Date(2026, 7, 1)
 * parseFrenchDate("invalid") // → null
 */
function parseFrenchDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const normalized = dateStr.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})\s+([a-zàâäéèêëïîôöùûüç]+)\s+(\d{4})$/);

  if (!match) return null;

  const [, dayStr, monthStr, yearStr] = match;
  const monthIndex = MONTHS_FR_INDEX[monthStr];

  if (monthIndex === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(year)) return null;

  return new Date(year, monthIndex, day);
}

/**
 * Formate une date de trajet selon la locale active.
 *
 * Les mocks stockent les dates comme strings FR ("12 juin 2026") pour des raisons
 * historiques. Cette fonction parse la string FR et la reformate selon la locale.
 *
 * Si la locale est "fr", retourne la string telle quelle (déjà au bon format).
 * Si la locale est "en", parse + reformate en anglais ("12 Jun 2026").
 *
 * @example
 * formatTripDate("12 juin 2026", "fr") // → "12 juin 2026"
 * formatTripDate("12 juin 2026", "en") // → "12 Jun 2026"
 * formatTripDate("01 août 2026", "en") // → "1 Aug 2026"
 *
 * @param dateStr Date FR au format "DD mois YYYY"
 * @param locale Locale active ("fr" ou "en")
 * @returns Date formatée selon la locale, ou la string brute si parsing échoue
 */
export function formatTripDate(dateStr: string, locale: string): string {
  // Si la locale est FR, la string est déjà au bon format
  if (locale === "fr") return dateStr;

  // Sinon on parse et on reformate selon la locale cible
  const date = parseFrenchDate(dateStr);
  if (!date) return dateStr; // fallback : retourne la string telle quelle

  const localeTag = locale === "en" ? "en-US" : locale;

  return new Intl.DateTimeFormat(localeTag, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
