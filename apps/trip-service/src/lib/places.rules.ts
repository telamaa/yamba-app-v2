/**
 * places.rules.ts — ce qu'on garde de la réponse de Google (règles PURES)
 * =======================================================================
 * Google renvoie beaucoup ; la recherche Yamba n'a besoin que de deux
 * chaînes par proposition — la ville et son contexte. Le tri et le choix
 * restent à Google (il connaît la popularité des lieux), nous ne faisons
 * que PROJETER et PLAFONNER.
 *
 * Ces règles sont pures et testées seules : la panne du 13/10
 * (autocomplétion muette) venait de la clé, pas du mapping, mais le
 * mapping n'avait AUCUN test pour le prouver.
 */
import { PLACES_MAX_SUGGESTIONS, type PlaceSuggestion } from "@packages/api-contracts";

/** La forme (partielle) de `places:autocomplete` — on ne déclare que ce qu'on lit. */
export type GoogleAutocompletePayload = {
  suggestions?: {
    placePrediction?: {
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
};

/**
 * `structuredFormat` d'abord (ville / contexte séparés), `text` en secours
 * (une seule chaîne : tout part dans `main`, le contexte reste vide — mieux
 * qu'une ligne vide). Une proposition sans nom est jetée.
 */
export function mapGoogleSuggestions(payload: GoogleAutocompletePayload): PlaceSuggestion[] {
  return (payload.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;
      return {
        main:
          prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text ?? "",
        secondary: prediction?.structuredFormat?.secondaryText?.text ?? "",
      };
    })
    .filter((suggestion) => suggestion.main.length > 0)
    .slice(0, PLACES_MAX_SUGGESTIONS);
}

/**
 * La clé de cache : la MÊME saisie dans la MÊME langue donne la même liste.
 * Insensible à la casse et aux espaces de bord — « paris », « Paris » et
 * « Paris » ne sont qu'une seule frappe pour Google.
 */
export function placesCacheKey(input: string, language: string): string {
  return `places:ac:${language}:${input.trim().toLowerCase()}`;
}
