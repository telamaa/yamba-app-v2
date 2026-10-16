/**
 * trip-format.ts — mise en forme de la fiche trajet (lot page trajet D36).
 * ========================================================================
 * MIROIR du sous-ensemble utile de `apps/user-ui/src/lib/public-trip.helpers.ts`
 * et de `trip-signals.ts` : mêmes tables de mois (pas d'`Intl.DateTimeFormat` —
 * indépendant du moteur JS ET du fuseau serveur), mêmes règles d'affichage.
 * Les montants restent en CENTS jusqu'ici — la conversion n'a lieu qu'au
 * moment de fabriquer la chaîne.
 */
import type { SupportedLocale } from '@packages/api-contracts/locale';

import type { TripDates } from '@/lib/api/trip.api';

/* ── Prix ────────────────────────────────────────────────────────────────── */

export function formatPrice(
  cents: number | null | undefined,
  currency = 'EUR',
  locale: SupportedLocale = 'fr'
): string {
  if (cents == null) return '-';
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Hermes sans données Intl pour cette devise : chiffre + code, jamais un crash.
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatPriceShort(
  cents: number | null | undefined,
  currency = 'EUR',
  locale: SupportedLocale = 'fr'
): string {
  if (cents == null) return '-';
  const value = cents / 100;
  const isInteger = value === Math.floor(value);
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(isInteger ? 0 : 2)} ${currency}`;
  }
}

/* ── Empreinte évitée (miroir de `public-trip.helpers.ts`) ──────────────── */

/** Distance à vol d'oiseau, en kilomètres (Haversine). */
export function calculateDistanceKm(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Grammes de CO₂ par kilo transporté et par kilomètre, en FRET EXPRESS —
 *  la référence que l'envoi par Voyageur évite. Mêmes valeurs que le site. */
const FREIGHT_EMISSION_G_PER_KG_PER_KM: Record<string, number> = {
  PLANE: 600,
  TRAIN: 30,
  CAR: 80,
};

/**
 * CO₂ évité vs fret express POUR UN COLIS de `weightKg` (2 kg par défaut,
 * la référence de la recherche). Le facteur étant en g/kg/km, oublier le
 * poids annoncerait l'émission d'UN kilo comme celle du colis.
 */
export function calculateCO2SavedKg(
  transportMode: string | null,
  origin: { lat: number | null; lng: number | null },
  destination: { lat: number | null; lng: number | null },
  weightKg = 2
): number | null {
  if (!transportMode) return null;
  const factor = FREIGHT_EMISSION_G_PER_KG_PER_KM[transportMode];
  if (factor === undefined) return null;
  const distanceKm = calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  if (distanceKm === null) return null;
  return (factor * distanceKm * Math.max(weightKg, 0.5)) / 1000;
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatLongDate(iso: string | null, locale: SupportedLocale = 'fr'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const month = locale === 'fr' ? FR_MONTHS[d.getMonth()] : EN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const weekday = locale === 'fr' ? FR_DAYS[d.getDay()] : EN_DAYS[d.getDay()];

  return locale === 'fr'
    ? `${weekday} ${day} ${month} ${year}`
    : `${weekday} ${month} ${day}, ${year}`;
}

/**
 * « 13 octobre » / « October 13 » — le jour sans l'année, pour les bornes de
 * recherche. MÊMES tables que le reste du fichier : jamais `toLocaleDateString`,
 * dont les données dépendent du moteur (Hermes) et de l'OS.
 */
export function formatDayMonth(date: Date, locale: SupportedLocale = 'fr'): string {
  if (isNaN(date.getTime())) return '';
  const month = locale === 'fr' ? FR_MONTHS[date.getMonth()] : EN_MONTHS[date.getMonth()];
  return locale === 'fr' ? `${date.getDate()} ${month}` : `${month} ${date.getDate()}`;
}

/**
 * « Paris, France » → « Paris ». L'autocomplétion enregistre « Ville, Pays »
 * (ce que le serveur attend, cf. `place-text.ts`), mais un RÉSUMÉ — la
 * pilule de recherche, le titre des résultats — n'a de place que pour la
 * ville. La précision reste visible dans les champs de l'éditeur.
 */
export function cityLabel(value: string): string {
  const first = value.split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : value.trim();
}

/** « Octobre 2026 » / « October 2026 » — le titre d'un mois de calendrier. */
export function formatMonthYear(date: Date, locale: SupportedLocale = 'fr'): string {
  const month = locale === 'fr' ? FR_MONTHS[date.getMonth()] : EN_MONTHS[date.getMonth()];
  const capitalised = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalised} ${date.getFullYear()}`;
}

/** L'en-tête des colonnes d'un calendrier, dans l'ordre de la semaine locale
 *  (`weekStartsOn` : lundi en FR, dimanche en EN). Deux lettres, comme le web. */
export function weekdayLabels(weekStartsOn: 0 | 1, locale: SupportedLocale = 'fr'): string[] {
  const source = locale === 'fr' ? FR_DAYS : EN_DAYS;
  return Array.from({ length: 7 }, (_, index) =>
    source[(index + weekStartsOn) % 7].slice(0, 2).toUpperCase()
  );
}

export function formatMemberSince(iso: string | null, locale: SupportedLocale = 'fr'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const month = locale === 'fr' ? FR_MONTHS[d.getMonth()] : EN_MONTHS[d.getMonth()];
  return `${month} ${d.getFullYear()}`;
}

/** L'heure LOCALE du lieu prime (celle du billet) ; l'ISO n'est qu'un secours. */
export function formatLocalTime(iso: string | null, fallbackTimeLocal: string | null): string {
  if (fallbackTimeLocal) return fallbackTimeLocal;
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatTripDuration(dates: TripDates): string | null {
  if (!dates.departureAt || !dates.arrivalAt) return null;

  const diffMin = Math.round(
    (new Date(dates.arrivalAt).getTime() - new Date(dates.departureAt).getTime()) / 60000
  );
  return formatMinutesDuration(diffMin);
}

/** « 2h37 », « 1j 4h », « 45min » — aussi pour `durationMinutes` du DTO de recherche. */
export function formatMinutesDuration(diffMin: number): string | null {
  if (diffMin < 0) return null;

  const days = Math.floor(diffMin / (60 * 24));
  const hours = Math.floor((diffMin % (60 * 24)) / 60);
  const minutes = diffMin % 60;

  if (days > 0) return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
  if (hours > 0) return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
  return `${minutes}min`;
}

/* ── Signaux (D5 / C-PR6, D60) ───────────────────────────────────────────── */

/** Seuil de PRÉSENTATION du badge « Populaire » — pas une règle métier. */
export const POPULAR_VIEWS = 20;
export const isPopular = (viewsCount: number | null | undefined): boolean =>
  typeof viewsCount === 'number' && viewsCount >= POPULAR_VIEWS;

/** Seuil d'ALLUMAGE du compteur de vues — pas une règle métier non plus.
 *  Une pastille « 5 vues » ne rassure personne : elle dit « personne ne
 *  regarde ça ». L'absence de badge est NEUTRE, un petit chiffre est
 *  NÉGATIF — donc on ne l'allume qu'une fois le signal crédible, et il
 *  devient « Populaire » à 20. */
export const MIN_SHOWN_VIEWS = 15;
export const showsViews = (viewsCount: number | null | undefined): viewsCount is number =>
  typeof viewsCount === 'number' && viewsCount >= MIN_SHOWN_VIEWS;

export function getInitials(firstName: string, lastInitial: string): string {
  const first = firstName?.charAt(0).toUpperCase() ?? '';
  return `${first}${lastInitial}`.trim() || '?';
}
