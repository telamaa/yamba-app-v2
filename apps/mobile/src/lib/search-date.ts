/**
 * search-date.ts — la date de recherche, miroir assumé du web.
 * ============================================================
 * Le site a un calendrier « intelligent » (`SmartDatePicker` /
 * `MobileSmartDatePicker`) : DEUX modes et TROIS raccourcis. On reprend sa
 * logique à l'identique — mêmes modes, mêmes fenêtres, mêmes libellés — pour
 * qu'une recherche lancée du téléphone et la même lancée du navigateur
 * trouvent exactement les mêmes trajets.
 *
 *   • exact → un jour précis
 *   • flex  → « Cette semaine » · « Ce mois » · « 3 prochains mois »
 *
 * MIROIR ASSUMÉ, comme `trip-format.ts` et `pricing-example.ts` (A205) : le
 * jour où un troisième front existe, ces règles migrent dans un paquet
 * partagé. En attendant, toute divergence ici est un BUG, pas une variante.
 *
 * Le serveur ne connaît que `dateFrom` / `dateTo` : les modes n'existent
 * qu'à l'écran, ils se réduisent à une fenêtre avant de partir (RG-MOB-1,
 * le serveur reste seul juge).
 */
import type { SupportedLocale } from '@packages/api-contracts/locale';

import { formatDayMonth } from '@/lib/trip-format';

export type DateMode = 'exact' | 'flex';
export type FlexType = 'thisWeek' | 'thisMonth' | 'next3Months';

/** Miroir du `DateValue` web (`components/ui/SmartDatePicker`). */
export type SearchDate = {
  mode: DateMode;
  /** Le jour choisi en mode exact ; l'ancre du jour en mode flexible. */
  date: Date;
  flexType?: FlexType;
  rangeStart?: Date;
  rangeEnd?: Date;
};

export const FLEX_TYPES: FlexType[] = ['thisWeek', 'thisMonth', 'next3Months'];

/* ── Arithmétique de calendrier (le web utilise date-fns ; ici, zéro
      dépendance — les quelques règles tiennent en vingt lignes). ───────── */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  // Jour 0 du mois suivant = dernier jour de celui-ci.
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const day = startOfDay(d);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - diff);
}

function endOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const start = startOfWeek(d, weekStartsOn);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

/** La semaine commence le lundi en français, le dimanche en anglais — la
 *  convention exacte du web (`weekStartsOn` de `MobileSmartDatePicker`). */
export function weekStartFor(locale: SupportedLocale): 0 | 1 {
  return locale === 'fr' ? 1 : 0;
}

/* ── Les trois fenêtres flexibles ───────────────────────────────────────── */

export function flexRange(
  flexType: FlexType,
  today: Date,
  weekStartsOn: 0 | 1
): { rangeStart: Date; rangeEnd: Date } {
  if (flexType === 'thisWeek') {
    return { rangeStart: startOfWeek(today, weekStartsOn), rangeEnd: endOfWeek(today, weekStartsOn) };
  }
  if (flexType === 'thisMonth') {
    return { rangeStart: startOfMonth(today), rangeEnd: endOfMonth(today) };
  }
  // next3Months : du 1er de ce mois au dernier jour du mois +2.
  return { rangeStart: startOfMonth(today), rangeEnd: endOfMonth(addMonths(today, 2)) };
}

/* ── Constructeurs ──────────────────────────────────────────────────────── */

export function makeExact(date: Date): SearchDate {
  return { mode: 'exact', date: startOfDay(date) };
}

export function makeFlex(flexType: FlexType, locale: SupportedLocale, now = new Date()): SearchDate {
  const today = startOfDay(now);
  const { rangeStart, rangeEnd } = flexRange(flexType, today, weekStartFor(locale));
  return { mode: 'flex', date: today, flexType, rangeStart, rangeEnd };
}

/* ── Ce qui part au serveur ─────────────────────────────────────────────── */

/**
 * Les bornes envoyées à `GET /trips/search`. Une fenêtre flexible qui a déjà
 * commencé est ramenée à AUJOURD'HUI : chercher des trajets passés n'a aucun
 * sens, et le serveur les écarte de toute façon — autant ne pas les demander.
 */
export function dateBounds(value: SearchDate, now = new Date()): { dateFrom: string; dateTo: string } {
  if (value.mode === 'exact' || !value.rangeStart || !value.rangeEnd) {
    const start = startOfDay(value.date);
    return { dateFrom: start.toISOString(), dateTo: endOfDay(start).toISOString() };
  }
  const today = startOfDay(now);
  const start = value.rangeStart < today ? today : value.rangeStart;
  return { dateFrom: start.toISOString(), dateTo: endOfDay(value.rangeEnd).toISOString() };
}

/* ── Ce qui s'affiche dans la pilule récap ──────────────────────────────── */

/** Le libellé court de la barre de recherche. Les raccourcis se nomment par
 *  leur intention (« Cette semaine »), jamais par leurs bornes : c'est ce que
 *  l'utilisateur a choisi. */
export function summaryLabel(
  value: SearchDate | null,
  locale: SupportedLocale,
  labels: { any: string; flex: Record<FlexType, string> }
): string {
  if (value === null) return labels.any;
  if (value.mode === 'flex' && value.flexType) return labels.flex[value.flexType];
  return formatDayMonth(value.date, locale);
}

/** La fenêtre en toutes lettres, montrée SOUS les raccourcis : un raccourci
 *  qui ne dit pas ce qu'il couvre demande à l'utilisateur de deviner. */
export function rangeLabel(value: SearchDate, locale: SupportedLocale): string | null {
  if (value.mode !== 'flex' || !value.rangeStart || !value.rangeEnd) return null;
  return `${formatDayMonth(value.rangeStart, locale)} – ${formatDayMonth(value.rangeEnd, locale)}`;
}

/* ── La grille du calendrier (le web délègue à react-day-picker ; ici,
      vingt lignes de pur calcul — aucune dépendance à embarquer) ──────── */

/** Les `count` premiers jours de mois à partir du mois de `from` inclus. */
export function monthsFrom(from: Date, count: number): Date[] {
  const first = new Date(from.getFullYear(), from.getMonth(), 1);
  return Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth() + i, 1));
}

/**
 * Les semaines d'un mois, alignées sur le premier jour de la semaine locale.
 * Les cases hors du mois valent `null` : le calendrier n'affiche QUE les
 * jours du mois (le web masque aussi les jours voisins), une case vide se
 * lit mieux qu'un chiffre grisé appartenant à un autre mois.
 */
export function monthMatrix(month: Date, weekStartsOn: 0 | 1): (Date | null)[][] {
  const year = month.getFullYear();
  const index = month.getMonth();
  const daysInMonth = new Date(year, index + 1, 0).getDate();
  const lead = (new Date(year, index, 1).getDay() - weekStartsOn + 7) % 7;

  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, index, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Bornes INCLUSES (la fenêtre flexible se peint jusqu'à son dernier jour). */
export function isWithin(day: Date, start: Date, end: Date): boolean {
  const value = startOfDay(day).getTime();
  return value >= startOfDay(start).getTime() && value <= startOfDay(end).getTime();
}
