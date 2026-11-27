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
import {
  PLACES_MAX_SUGGESTIONS,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@packages/api-contracts";

/** La forme (partielle) de `places:autocomplete` — on ne déclare que ce qu'on lit. */
export type GoogleAutocompletePayload = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
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
        // D111 ter — l'identifiant qui permettra d'aller chercher le pays et
        // les coordonnées. Absent chez Google ⇒ chaîne vide : le client la
        // lit comme « pas de détail disponible » plutôt que d'appeler avec
        // un identifiant vide.
        placeId: prediction?.placeId ?? "",
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

/* ── Détail d'un lieu (D111 ter) ──────────────────────────────────────── */

/** La forme (partielle) de `places/{id}` — on ne déclare que ce qu'on lit. */
export type GooglePlaceDetailsPayload = {
  location?: { latitude?: number; longitude?: number };
  displayName?: { text?: string };
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
};

/** Un composant d'adresse porte un TYPE : c'est par lui qu'on le retrouve. */
function composant(payload: GooglePlaceDetailsPayload, type: string) {
  return (payload.addressComponents ?? []).find((c) => (c.types ?? []).includes(type));
}

/**
 * Ce qu'on garde d'un lieu : sa ville, son pays, son code pays, ses
 * coordonnées. Rien d'autre ne sert au calcul de corridor.
 *
 * TROIS PRUDENCES, et chacune a sa raison :
 *   • la VILLE vient du composant `locality` quand il existe, du nom affiché
 *     sinon — une proposition d'AÉROPORT n'a pas toujours de `locality`, et
 *     « Aéroport de Paris-Charles-de-Gaulle » vaut mieux qu'une chaîne vide ;
 *   • le CODE PAYS est mis en MAJUSCULES et vérifié à deux lettres. Google
 *     rend bien « FR », mais le code voyage ensuite jusqu'à une table de
 *     zones : un « fr » minuscule y tomberait dans le repli sans que rien ne
 *     le dise ;
 *   • une COORDONNÉE non finie (absente, `null`, `NaN`) devient `null`. Un
 *     calcul de distance avec un `NaN` rend `NaN`, et `NaN` traverse toutes
 *     les comparaisons sans en déclencher une seule (la leçon d'A224 lot 3).
 */
export function mapGoogleDetails(payload: GooglePlaceDetailsPayload): PlaceDetails {
  const ville = composant(payload, "locality")?.longText ?? payload.displayName?.text ?? "";
  const pays = composant(payload, "country");
  const code = (pays?.shortText ?? "").trim().toUpperCase();
  const nombre = (valeur: number | undefined): number | null =>
    typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;

  return {
    city: ville,
    country: pays?.longText?.trim() || null,
    countryCode: /^[A-Z]{2}$/.test(code) ? code : null,
    lat: nombre(payload.location?.latitude),
    lng: nombre(payload.location?.longitude),
  };
}

/**
 * La clé de cache d'un détail.
 *
 * Elle inclut la LANGUE parce que la ville et le pays en dépendent
 * (« Allemagne » / « Germany »), mais pas le jeton de session : deux
 * sessions qui demandent le même lieu doivent partager la réponse — c'est
 * tout l'intérêt du cache, et Google facture la session, pas la lecture.
 */
export function placeDetailsCacheKey(placeId: string, language: string): string {
  return `places:det:${language}:${placeId.trim()}`;
}
