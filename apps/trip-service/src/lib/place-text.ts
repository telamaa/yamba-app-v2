/**
 * place-text.ts — le texte d'un lieu tel que la recherche le comprend
 * ===================================================================
 * Le front normalise chaque lieu choisi dans l'autocomplétion en « Ville, Pays »
 * (« Brazzaville, République du Congo », « Amsterdam, Pays-Bas ») — c'est ce libellé que la
 * barre de recherche envoie dans `from` / `to`. Or la recherche compare ce texte à `originCity`
 * ET `originCountry` par un `contains` : « Brazzaville, République du Congo » n'est contenu ni
 * dans « Brazzaville » ni dans « République du Congo » → **zéro résultat** pour toute ville
 * étrangère choisie dans la liste (recette 01-WEB 5.1, WEB-ACC-9, 10/09/2026 — bloquant).
 *
 * Règle : le terme cherché est le PREMIER segment avant une virgule — la ville. Le pays qui suit
 * est une aide à la lecture, pas un critère : il dépend de la langue de l'écran (« République du
 * Congo » / « Republic of the Congo ») alors que la base porte le pays dans la langue de celui
 * qui a publié le trajet. Un texte tapé à la main (« Congo ») reste cherché tel quel : il touche
 * `originCountry` par le même `contains`.
 */

/** Le terme à comparer aux villes et pays d'un trajet, ou `null` s'il ne reste rien. */
export function placeSearchTerm(text: string | null | undefined): string | null {
  if (!text) return null;
  const premier = text.split(",")[0]?.trim() ?? "";
  return premier.length > 0 ? premier : null;
}
