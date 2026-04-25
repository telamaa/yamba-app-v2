import { DepartureTimeBucket } from "./search-results.types";

/**
 * Convertit une heure "HH:MM" en bucket horaire.
 *
 * Découpage:
 *  - morning   : 06:00 - 11:59
 *  - afternoon : 12:00 - 17:59
 *  - evening   : 18:00 - 21:59
 *  - night     : 22:00 - 05:59
 *
 * @example
 * getDepartureTimeBucket("08:00") // "morning"
 * getDepartureTimeBucket("14:30") // "afternoon"
 * getDepartureTimeBucket("19:45") // "evening"
 * getDepartureTimeBucket("23:30") // "night"
 * getDepartureTimeBucket(undefined) // null
 */
export function getDepartureTimeBucket(
  time: string | undefined
): DepartureTimeBucket | null {
  if (!time) return null;

  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;

  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * True si l'heure de départ d'un trajet appartient à au moins un des buckets sélectionnés.
 * Si aucun bucket sélectionné => le filtre est désactivé => true par défaut.
 */
export function matchesDepartureBuckets(
  departureTime: string | undefined,
  selectedBuckets: DepartureTimeBucket[]
): boolean {
  if (selectedBuckets.length === 0) return true;
  const bucket = getDepartureTimeBucket(departureTime);
  if (!bucket) return false;
  return selectedBuckets.includes(bucket);
}
