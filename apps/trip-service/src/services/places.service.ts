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
import type { PlaceSuggestion } from "@packages/api-contracts";

import {
  mapGoogleSuggestions,
  placesCacheKey,
  type GoogleAutocompletePayload,
} from "../lib/places.rules";

const ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";
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
