/**
 * places.api.ts — l'autocomplétion de villes, par NOTRE API (A211).
 * ==================================================================
 * `GET /places/autocomplete` (gateway → trip-service). L'app n'appelle plus
 * Google directement et n'embarque plus aucune clé.
 *
 * Pourquoi ce virage (diagnostic du 13/10) : une clé Google utilisable par
 * une app mobile devrait voyager DANS le bundle, donc être extractible et
 * facturable par n'importe qui — et une clé restreinte par referer, comme
 * celle du site, est de toute façon REFUSÉE à un `fetch` natif, qui n'envoie
 * pas de referer (`API_KEY_HTTP_REFERRER_BLOCKED`). La clé vit maintenant
 * côté serveur, la limitation de débit est la nôtre, et le serveur met les
 * frappes populaires en cache 5 minutes.
 *
 * Le `sessionToken` reste fabriqué ICI et relayé tel quel : seul le client
 * sait quand une saisie commence et finit, et c'est ce jeton qui groupe la
 * facturation Google.
 *
 * Le résultat DISTINGUE « zéro ville ne correspond » (200, liste vide) de
 * « le service ne répond pas » (503 `PLACES_UNAVAILABLE`, ou réseau mort) :
 * sans cette distinction, l'écran accusait la saisie d'une panne de service.
 */
import { ApiError, apiFetch } from './client';

export type CitySuggestion = {
  /** La ville seule (« Paris ») — ce qui part dans la recherche. */
  main: string;
  /** Le contexte (« France », « Texas, États-Unis ») — affiché en second. */
  secondary: string;
  /**
   * L'identifiant Google du lieu (D111 ter), vide quand Google n'en donne
   * pas. C'est lui qui ouvre `GET /places/details`, donc le code pays, donc
   * le corridor, donc la fourchette de prix.
   */
  placeId: string;
};

/** Ce que rend `GET /places/details` — tout est nullable sauf la ville. */
export type CityDetails = {
  city: string;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
};

/** `unavailable` : réseau coupé, relais muet, ou Google en refus. */
export type CitySuggestResult =
  | { status: 'ok'; items: CitySuggestion[] }
  | { status: 'unavailable' };

const MIN_CHARS = 2;

export async function suggestCities(
  input: string,
  locale: string,
  sessionToken: string
): Promise<CitySuggestResult> {
  const term = input.trim();
  if (term.length < MIN_CHARS) return { status: 'ok', items: [] };

  const query = new URLSearchParams({ input: term, language: locale, sessionToken });
  try {
    const page = await apiFetch<{ suggestions: CitySuggestion[] }>(
      `/places/autocomplete?${query.toString()}`,
      // Visiteur comme membre : la recherche est publique, un 401 ne doit
      // pas déclencher de cycle de rafraîchissement pour une suggestion.
      { requireAuth: false }
    );
    return { status: 'ok', items: page.suggestions };
  } catch (error) {
    if (__DEV__) {
      const detail =
        error instanceof ApiError ? `${error.status} ${error.code ?? ''}` : String(error);
      console.warn('[places] suggestions indisponibles :', detail);
    }
    return { status: 'unavailable' };
  }
}

/**
 * Le détail d'une ville CHOISIE — pays, code pays, coordonnées.
 *
 * Appelé une seule fois, au moment du choix, avec le MÊME jeton de session
 * que l'autocomplétion qui l'a précédé : Google facture alors l'ensemble
 * comme une seule session.
 *
 * Rend `null` pour tout échec (service muet, identifiant inconnu, réseau
 * coupé) : la fourchette de prix est un CONFORT. Sans elle, le tunnel
 * continue avec la base de repli — il ne s'arrête jamais pour ça.
 */
export async function fetchPlaceDetails(
  placeId: string,
  locale: string,
  sessionToken: string
): Promise<CityDetails | null> {
  if (placeId.trim().length === 0) return null;
  const query = new URLSearchParams({ placeId, language: locale, sessionToken });
  try {
    return await apiFetch<CityDetails>(`/places/details?${query.toString()}`, {
      requireAuth: false,
    });
  } catch (error) {
    if (__DEV__) {
      const detail =
        error instanceof ApiError ? `${error.status} ${error.code ?? ''}` : String(error);
      console.warn('[places] détail indisponible :', detail);
    }
    return null;
  }
}

/**
 * La lecture d'une suggestion (libellé normalisé, pays) vit dans un module
 * PUR — `lib/place-label.ts` —, parce qu'une règle qui décide de ce que le
 * serveur reçoit doit être vérifiable par une fiche, et que ce fichier-ci
 * est inatteignable depuis le harnais (il tire `expo-constants`). Réexporté
 * ici pour ses appelants : la règle n'a qu'un domicile, pas deux.
 */
export { placeCountry, placeLabel } from '@/lib/place-label';
