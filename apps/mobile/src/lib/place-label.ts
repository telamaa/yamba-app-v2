/**
 * place-label.ts — lire une suggestion de ville, hors de tout appel réseau.
 * ==========================================================================
 * La règle vivait dans `api/places.api.ts`, qui tire `client.ts` →
 * `base-url.ts` → `expo-constants` : le harnais (`testEnvironment: node`) ne
 * sait pas traverser cette chaîne, donc personne ne vérifiait une règle qui
 * décide pourtant de ce que le SERVEUR reçoit (WEB-ACC-9). Quand une fiche
 * ne peut pas charger ton code, elle te dit où est la frontière : on déplace
 * le code, pas la frontière (D102).
 *
 * `places.api.ts` réexporte `placeLabel` pour ne rien casser chez ses
 * appelants — la règle, elle, n'a plus qu'un domicile.
 */

export type SuggestionDeVille = {
  /** La ville seule (« Paris »). */
  main: string;
  /** Le contexte (« France », « Texas, États-Unis », « Route de l'Aéroport, Tillé »). */
  secondary: string;
};

/**
 * Le PAYS d'une suggestion, ou «  » quand Google n'en donne pas.
 *
 * Le contexte peut porter plusieurs segments : seul le DERNIER est un pays,
 * c'est la règle du site. Divergence assumée avec lui : il replie sur
 * « France » quand le pays manque (son SDK est chargé `region=FR`) ; notre
 * relais n'a pas ce biais, un contexte vide reste donc vide plutôt que
 * d'inventer un pays.
 */
export function placeCountry(suggestion: SuggestionDeVille): string {
  const dernier = suggestion.secondary
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  if (!dernier || dernier === suggestion.main) return '';
  return dernier;
}

/**
 * « Paris » + « France » → « Paris, France ».
 *
 * C'est CE libellé que le serveur attend : `placeSearchTerm` (trip-service)
 * ne garde que le premier segment avant la virgule, le pays n'est qu'une aide
 * à la lecture — sans cette normalisation, toute ville étrangère choisie dans
 * la liste rendait zéro résultat (WEB-ACC-9).
 */
export function placeLabel(suggestion: SuggestionDeVille): string {
  const pays = placeCountry(suggestion);
  return pays === '' ? suggestion.main : `${suggestion.main}, ${pays}`;
}
