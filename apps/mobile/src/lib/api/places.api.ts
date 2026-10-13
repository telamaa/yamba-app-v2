/**
 * places.api.ts — l'autocomplétion de villes (lot recherche-first).
 * =================================================================
 * Le MIROIR du canal web : le site charge le SDK JS Google dans le
 * navigateur avec la clé publique `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ; ici,
 * pas de DOM, donc l'API REST « Places (New) » avec la clé publique
 * `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — même modèle de confiance (clé
 * restreinte côté console Google : referrer pour le web, bundle/empreinte
 * pour l'app). Mêmes réglages que `CityAutocomplete` du site : 2 caractères
 * minimum, types `locality` + `airport`, jeton de session (la facturation
 * Google groupe les frappes d'une même saisie), langue de l'écran.
 * Sans clé ou en cas d'échec, le champ reste une saisie LIBRE —
 * l'autocomplétion est un confort, jamais un préalable. Mais le résultat
 * DISTINGUE « zéro ville ne correspond » de « le service ne répond pas » :
 * un tableau vide dans les deux cas faisait dire « Aucune ville trouvée »
 * à un écran qui n'avait tout simplement pas pu demander (diagnostic du
 * 13/10 : la clé de la racine appartient à un projet Google SANS
 * FACTURATION, toutes les API répondent 403 — l'écran accusait la ville).
 * Et toute panne est TRACÉE en développement : une erreur avalée en
 * silence est une erreur qu'on ne corrige jamais.
 */
export type CitySuggestion = {
  /** La ville seule (« Paris ») — ce qui part dans la recherche. */
  main: string;
  /** Le contexte (« France ») — affiché en second. */
  secondary: string;
};

const ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete';
// Huit, comme le site (`CityAutocomplete`, `preds.slice(0, 8)`).
const MAX_SUGGESTIONS = 8;

type AutocompleteResponse = {
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

/** `unavailable` : pas de clé, réseau coupé, ou refus de Google. */
export type CitySuggestResult =
  | { status: 'ok'; items: CitySuggestion[] }
  | { status: 'unavailable' };

function unavailable(reason: string, detail?: unknown): CitySuggestResult {
  if (__DEV__) console.warn('[places] suggestions indisponibles :', reason, detail ?? '');
  return { status: 'unavailable' };
}

export async function suggestCities(
  input: string,
  locale: string,
  sessionToken: string
): Promise<CitySuggestResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const term = input.trim();
  if (!apiKey) return unavailable('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY absente du bundle');
  if (term.length < 2) return { status: 'ok', items: [] };
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify({
        input: term,
        includedPrimaryTypes: ['locality', 'airport'],
        languageCode: locale,
        sessionToken,
      }),
    });
    if (!response.ok) {
      // Le corps porte le VRAI motif (clé restreinte par referer, facturation
      // désactivée, API non activée) : sans lui, le défaut est indiagnosticable.
      return unavailable(`HTTP ${response.status}`, await response.text().catch(() => ''));
    }
    const data = (await response.json()) as AutocompleteResponse;
    const items = (data.suggestions ?? [])
      .map((s) => ({
        main:
          s.placePrediction?.structuredFormat?.mainText?.text ??
          s.placePrediction?.text?.text ??
          '',
        secondary: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
      }))
      .filter((s) => s.main.length > 0)
      .slice(0, MAX_SUGGESTIONS);
    return { status: 'ok', items };
  } catch (error) {
    return unavailable('réseau', error);
  }
}

/**
 * « Paris » + « France » → « Paris, France ». Le libellé NORMALISÉ que le
 * serveur attend : `placeSearchTerm` (trip-service) ne garde que le premier
 * segment avant la virgule, le pays n'est qu'une aide à la lecture
 * (WEB-ACC-9 — sans cette règle, toute ville étrangère choisie dans la
 * liste rendait zéro résultat).
 *
 * Le contexte de Google peut porter plusieurs segments (« Route de
 * l'Aéroport, Tillé ») : seul le DERNIER est un pays, c'est la règle du
 * site. Divergence assumée : le site replie sur « France » quand le pays
 * est omis (son SDK est chargé avec `region=FR`) ; l'API REST d'ici n'a pas
 * ce biais, un contexte vide reste donc vide plutôt que d'inventer un pays.
 */
export function placeLabel(suggestion: CitySuggestion): string {
  const country = suggestion.secondary
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  if (!country || country === suggestion.main) return suggestion.main;
  return `${suggestion.main}, ${country}`;
}
