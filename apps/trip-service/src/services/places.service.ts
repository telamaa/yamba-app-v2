/**
 * places.service.ts — l'appel à Google, et le cache qui le protège (A211)
 * ========================================================================
 * La clé vit ICI, sur le serveur (`GOOGLE_MAPS_SERVER_API_KEY`, .env RACINE)
 * et ne part jamais au client : c'est toute la raison d'être du relais.
 *
 * Trois protections, parce que l'endpoint est PUBLIC et que chaque appel
 * est facturé par Google :
 *   1. le gateway limite déjà le débit par IP (anonyme compris) ;
 *   2. un cache Redis de 5 minutes par (saisie, langue) : une même frappe
 *      populaire (« Paris ») n'est demandée qu'une fois par fenêtre ;
 *   3. en cas de panne du cache, on sert quand même — jamais l'inverse.
 *
 * `null` signifie INDISPONIBLE (clé absente, Google muet ou en refus), et
 * se distingue d'une liste vide (« aucune ville ne correspond ») : le client
 * doit pouvoir dire la vérité à l'utilisateur.
 */
import redis from "@packages/libs/redis";
import type { PlaceDetails, PlaceSuggestion } from "@packages/api-contracts";

import {
  mapGoogleDetails,
  mapGoogleSuggestions,
  placeDetailsCacheKey,
  placesCacheKey,
  type GoogleAutocompletePayload,
  type GooglePlaceDetailsPayload,
} from "../lib/places.rules";

const ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
/**
 * Le détail d'un lieu, lui, ne bouge pas : le code pays de Paris ne changera
 * pas cette semaine. Vingt-quatre heures — c'est autant d'appels facturés en
 * moins sur les corridors populaires.
 */
const DETAILS_CACHE_TTL_SECONDS = 86_400;
/**
 * Les SEULS champs demandés. La facturation de Google dépend de ce masque :
 * demander `*` ferait payer le niveau « Enterprise » pour quatre valeurs.
 */
const DETAILS_FIELD_MASK = "location,displayName,addressComponents";
/** Court : une liste de villes bouge peu, mais une frappe à la mode ne doit
 *  pas rester figée une journée. */
const CACHE_TTL_SECONDS = 300;
/** Au-delà, Google est considéré muet : l'écran ne doit pas attendre. */
const TIMEOUT_MS = 3000;

export type PlacesLookup = {
  input: string;
  language: string;
  sessionToken?: string;
};

/** Lecture du cache — une panne Redis ne doit jamais casser la recherche. */
async function readCache(key: string): Promise<PlaceSuggestion[] | null> {
  try {
    const cached = await redis.get(key);
    return cached === null ? null : (JSON.parse(cached) as PlaceSuggestion[]);
  } catch {
    return null;
  }
}

async function writeCache(key: string, suggestions: PlaceSuggestion[]): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(suggestions), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Cache muet : on a déjà la réponse, elle part quand même.
  }
}

/**
 * Les propositions pour une saisie, ou `null` si le service est indisponible.
 * Jamais d'exception : l'autocomplétion est un confort, jamais un préalable.
 */
export async function lookupPlaces({
  input,
  language,
  sessionToken,
}: PlacesLookup): Promise<PlaceSuggestion[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_MAPS_SERVER_API_KEY absente — autocomplétion désactivée");
    return null;
  }

  const key = placesCacheKey(input, language);
  const cached = await readCache(key);
  if (cached !== null) return cached;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input: input.trim(),
        // Villes et aéroports uniquement — les mêmes types que le site : plus
        // de rues, de quartiers ni de points d'intérêt.
        includedPrimaryTypes: ["locality", "airport"],
        languageCode: language,
        ...(sessionToken ? { sessionToken } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Le corps porte le motif exact (clé restreinte, facturation absente,
      // API non activée) : sans lui, la panne est indiagnosticable — c'est
      // précisément ce qui a coûté la journée du 13/10.
      const body = await response.text().catch(() => "");
      console.warn(`[places] Google a refusé (HTTP ${response.status}) : ${body.slice(0, 300)}`);
      return null;
    }

    const suggestions = mapGoogleSuggestions((await response.json()) as GoogleAutocompletePayload);
    await writeCache(key, suggestions);
    return suggestions;
  } catch (error) {
    console.warn("[places] appel Google impossible :", error);
    return null;
  }
}

/* ── Détail d'un lieu (D111 ter) ──────────────────────────────────────── */

async function readDetailsCache(key: string): Promise<PlaceDetails | null> {
  try {
    const cached = await redis.get(key);
    return cached === null ? null : (JSON.parse(cached) as PlaceDetails);
  } catch {
    return null;
  }
}

export type PlaceDetailsLookup = {
  placeId: string;
  language: string;
  sessionToken?: string;
};

/**
 * Trois issues, et elles ne se confondent pas :
 *   • le détail ;
 *   • `"unknown"` — Google ne connaît pas cet identifiant (404). Le client a
 *     envoyé un identifiant périmé ou fabriqué : ce n'est pas une panne ;
 *   • `null` — le service est indisponible (clé absente, Google muet).
 * Confondre les deux derniers ferait dire « réessaie plus tard » à qui doit
 * recommencer sa saisie, et inversement.
 */
export type PlaceDetailsOutcome = PlaceDetails | "unknown" | null;

/**
 * Le pays et les coordonnées d'un lieu CHOISI, ou `null` si indisponible.
 *
 * Appelé une fois par ville retenue — jamais à chaque frappe. Le
 * `sessionToken` est relayé tel quel : avec lui, Google facture
 * l'autocomplétion et ce détail comme UNE session.
 *
 * Jamais d'exception, comme l'autocomplétion : un corridor inconnu fait
 * retomber le calcul de prix sur sa base de repli, il ne casse pas un écran.
 */
export async function lookupPlaceDetails({
  placeId,
  language,
  sessionToken,
}: PlaceDetailsLookup): Promise<PlaceDetailsOutcome> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_MAPS_SERVER_API_KEY absente — détail de lieu désactivé");
    return null;
  }

  const key = placeDetailsCacheKey(placeId, language);
  const cached = await readDetailsCache(key);
  if (cached !== null) return cached;

  try {
    const url = new URL(`${DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`);
    url.searchParams.set("languageCode", language);
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404) return "unknown";

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[places] détail refusé (HTTP ${response.status}) : ${body.slice(0, 300)}`);
      return null;
    }

    const details = mapGoogleDetails((await response.json()) as GooglePlaceDetailsPayload);
    try {
      await redis.set(key, JSON.stringify(details), "EX", DETAILS_CACHE_TTL_SECONDS);
    } catch {
      // Cache muet : la réponse part quand même.
    }
    return details;
  } catch (error) {
    console.warn("[places] détail de lieu impossible :", error);
    return null;
  }
}
