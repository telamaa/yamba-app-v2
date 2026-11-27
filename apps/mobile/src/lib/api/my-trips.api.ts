/**
 * my-trips.api.ts — les trajets du Voyageur, et leurs gestes de cycle de vie.
 * ============================================================================
 * `GET /trips/my` rend TOUS les statuts avec, pour chacun, le champ
 * `allowedActions` calculé par la machine à états du serveur. C'est lui qui
 * commande l'interface : l'app ne décide jamais si un trajet peut être
 * annulé (D72 — un trajet avec une réservation vivante ne s'annule pas, et
 * seul le serveur connaît les réservations).
 *
 * Les gestes de cycle de vie JETTENT, au contraire des lectures : ils
 * changent l'état d'une annonce publique, et un refus doit se voir.
 */
import { apiFetch } from './client';
import { withLocalDates } from '@/lib/trip-local-dates';

/** Un trajet brut, tel que l'API le rend — projeté par `lib/mes-trajets.ts`. */
export type TrajetBrut = Record<string, unknown>;

/**
 * Tous mes trajets. Rend une liste VIDE en cas d'échec : un écran de liste
 * sait dire « rien à montrer », il ne sait rien faire d'une exception.
 *
 * NORMALISÉ AU BORD DE LA LECTURE (`withLocalDates`), à l'endroit exact où le
 * site le fait dans ses hooks. `departureDateLocal` est OPTIONNEL en base et
 * le serveur ne le calcule jamais (`data.departureDateLocal ?? null`) : seul
 * un formulaire de création l'écrit. Mesuré sur la base de recette — trois
 * trajets sur cinq ne l'avaient pas, dont deux PUBLIÉS et trouvables en
 * recherche. Sans cette ligne, la carte annonce « Date à choisir » sur un
 * trajet qui a une date de départ (ANO-WEB-41, côté téléphone).
 */
export async function mesTrajets(): Promise<TrajetBrut[]> {
  try {
    const reponse = await apiFetch<{ trips?: TrajetBrut[] } | TrajetBrut[]>('/trips/my');
    const trajets = Array.isArray(reponse) ? reponse : (reponse.trips ?? []);
    return trajets.map((trajet) => withLocalDates(trajet));
  } catch {
    return [];
  }
}

/** Met un trajet publié en pause : il quitte la recherche, il n'est pas annulé. */
export function mettreEnPause(tripId: string): Promise<unknown> {
  return apiFetch(`/trips/${tripId}/pause`, { method: 'POST' });
}

/** Remet en ligne un trajet en pause. */
export function remettreEnLigne(tripId: string): Promise<unknown> {
  return apiFetch(`/trips/${tripId}/resume`, { method: 'POST' });
}

/**
 * Annule un trajet publié. Le serveur refuse (409 `TRIP_HAS_ACTIVE_DEALS`)
 * s'il porte une réservation vivante — le Voyageur doit alors annuler chaque
 * réservation d'abord (ANN-02), et c'est à lui que cela coûte.
 */
export function annulerLeTrajet(tripId: string): Promise<unknown> {
  return apiFetch(`/trips/${tripId}/cancel`, { method: 'POST' });
}

/** Restaure un trajet annulé : il redevient un BROUILLON, pas une annonce. */
export function restaurerLeTrajet(tripId: string): Promise<unknown> {
  return apiFetch(`/trips/${tripId}/restore`, { method: 'POST' });
}
