/**
 * trip-local-dates.ts — les dates « locales » d'un trajet, dérivées quand personne ne les a écrites
 * ==================================================================================================
 * ANO-WEB-41 (recette 5.14, même famille qu'ANO-WEB-22). Les écrans lisent
 * `departureDateLocal` / `departureTimeLocal` (et leurs pendants d'arrivée) :
 * des chaînes que seul un formulaire de création écrit. Un trajet venu d'un
 * autre canal — API, seed, autre client — n'en a pas, et l'écran affichait
 * alors « jeu. 1 janv. » (l'époque Unix), rangeait un trajet parti dans « à
 * venir », et trompait le tri.
 *
 * L'API sert toujours l'instant absolu (`departureAt` / `arrivalAt`) et les
 * fuseaux des lieux (`originTimezone` / `destinationTimezone`) : on en dérive
 * la date et l'heure locales, dans le fuseau du LIEU quand il est connu,
 * sinon dans celui de l'appareil. Ce n'est donc pas une déduction au jugé —
 * c'est une conversion exacte dès que le fuseau est là, et c'est ce qui la
 * distingue de la règle D111 quater 2C, qui refuse de deviner une date pour
 * PUBLIER. Ici on AFFICHE, et on a le fuseau.
 *
 * Les chaînes déjà écrites gardent la priorité : elles disent ce que le
 * Voyageur a saisi, pas ce qu'un calcul en pense.
 *
 * ⚠️ Ce fichier est DUPLIQUÉ à l'identique dans `apps/mobile/src/lib/` et une
 * fiche compare les deux copies À L'OCTET PRÈS — même dispositif que
 * `pricing-example.ts` (D99), `search-facets.ts` (D100) et `parcel-weight.ts`
 * (D101), pour la même raison : un `import` par-dessus la frontière d'un
 * projet est une dépendance de BUILD (D93).
 *
 * Pur, sans dépendance : appelé une fois, au BORD de la lecture, par les
 * hooks du site (`useMyTrips`, `useTrip`) et par `mesTrajets()` sur le mobile.
 */

/**
 * Ce qu'un trajet doit porter pour être normalisé. Exporté : les appelants
 * et les fiches ont besoin de le NOMMER, et un type que l'on ne peut pas
 * nommer pousse à écrire des `any` chez le lecteur.
 */
export type TripDatesLike = {
  departureDateLocal?: string | null;
  departureTimeLocal?: string | null;
  arrivalDateLocal?: string | null;
  arrivalTimeLocal?: string | null;
  departureAt?: string | Date | null;
  arrivalAt?: string | Date | null;
  originTimezone?: string | null;
  destinationTimezone?: string | null;
};

/** « 2026-09-26 » et « 14:00 » pour un instant, dans un fuseau (repli : celui de l'appareil). */
export function localDateTime(
  iso: string | Date | null | undefined,
  timeZone: string | null | undefined
): { date: string; time: string } | null {
  if (!iso) return null;
  const instant = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      ...options,
      timeZone: timeZone ?? undefined,
    }).formatToParts(instant);
  } catch {
    // Fuseau inconnu du moteur : on retombe sur celui de l'appareil plutôt
    // que de ne rien rendre. Une date approchée d'une heure vaut mieux que
    // « 1 janv. 1970 », qui est le défaut que ce fichier existe pour tuer.
    parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(instant);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/**
 * Le trajet avec ses quatre chaînes locales garanties dès que l'instant
 * absolu existe.
 *
 * Le retour est `T & TripDatesLike`, pas `T` : la fonction AJOUTE des champs
 * que l'entrée n'avait pas, et un type qui prétend rendre exactement son
 * entrée ment sur ce qu'elle fait. Dit autrement, `T` seul rendait
 * `trajet.departureDateLocal` inaccessible juste après l'appel qui vient de
 * l'écrire — c'est le contrôle « TypeScript (fiches de test) » qui l'a
 * montré, Jest étant vert pendant ce temps.
 */
export function withLocalDates<T extends TripDatesLike>(trip: T): T & TripDatesLike {
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
export function withLocalDatesInList<T extends TripDatesLike>(
  data: T[] | { trips?: T[] } | null | undefined
) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(withLocalDates);
  if (Array.isArray(data.trips)) return { ...data, trips: data.trips.map(withLocalDates) };
  return data;
}
