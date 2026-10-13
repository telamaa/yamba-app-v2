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

export function getInitials(firstName: string, lastInitial: string): string {
  const first = firstName?.charAt(0).toUpperCase() ?? '';
  return `${first}${lastInitial}`.trim() || '?';
}
