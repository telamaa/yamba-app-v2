/**
 * trip-local-dates.ts — les dates « locales » d'un trajet, dérivées quand le wizard ne les a pas écrites
 * =====================================================================================================
 * ANO-WEB-41 (recette 5.14, même famille qu'ANO-WEB-22). Le tableau de bord, « Mes trajets », la
 * fiche d'un trajet et le badge de navigation lisent `departureDateLocal` / `departureTimeLocal`
 * (et leurs pendants d'arrivée) : des chaînes que SEUL le wizard de création écrit. Un trajet créé
 * par un autre canal (API, seed, futur client mobile) n'en a pas — l'écran affichait alors
 * « jeu. 1 janv. » (l'époque Unix), rangeait un trajet parti dans « à venir », et trompait le tri.
 *
 * L'API sert toujours l'instant absolu (`departureAt` / `arrivalAt`) et les fuseaux des lieux
 * (`originTimezone` / `destinationTimezone`) : on en dérive la date et l'heure locales, dans le
 * fuseau du lieu quand il est connu, sinon dans celui du navigateur (c'est ce que le mapper
 * d'écriture du wizard utilise). Les chaînes du wizard, quand elles existent, gardent la priorité.
 * Pure, sans dépendance : appelée une fois par les hooks de lecture (`useMyTrips`, `useTrip`).
 */

type TripDatesLike = {
  departureDateLocal?: string | null;
  departureTimeLocal?: string | null;
  arrivalDateLocal?: string | null;
  arrivalTimeLocal?: string | null;
  departureAt?: string | Date | null;
  arrivalAt?: string | Date | null;
  originTimezone?: string | null;
  destinationTimezone?: string | null;
};

/** « 2026-09-26 » et « 14:00 » pour un instant, dans un fuseau (repli : celui du navigateur). */
export function localDateTime(
  iso: string | Date | null | undefined,
  timeZone: string | null | undefined
): { date: string; time: string } | null {
  if (!iso) return null;
  const instant = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timeZone ?? undefined }).formatToParts(instant);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(instant); // fuseau inconnu → navigateur
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Le trajet avec ses quatre chaînes locales garanties dès que l'instant absolu existe. */
export function withLocalDates<T extends TripDatesLike>(trip: T): T {
  const dep = localDateTime(trip.departureAt, trip.originTimezone);
  const arr = localDateTime(trip.arrivalAt, trip.destinationTimezone);
  if (!dep && !arr) return trip;
  return {
    ...trip,
    departureDateLocal: trip.departureDateLocal || dep?.date || trip.departureDateLocal,
    departureTimeLocal: trip.departureTimeLocal || dep?.time || trip.departureTimeLocal,
    arrivalDateLocal: trip.arrivalDateLocal || arr?.date || trip.arrivalDateLocal,
    arrivalTimeLocal: trip.arrivalTimeLocal || arr?.time || trip.arrivalTimeLocal,
  };
}

/** La réponse de `GET /trips/my` (tableau nu ou `{ trips }`), chaque trajet normalisé. */
export function withLocalDatesInList<T extends TripDatesLike>(data: T[] | { trips?: T[] } | null | undefined) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(withLocalDates);
  if (Array.isArray(data.trips)) return { ...data, trips: data.trips.map(withLocalDates) };
  return data;
}
