/**
 * last-search.ts — la mémoire de la dernière recherche (D106).
 * =============================================================
 * Le défaut, en une phrase : **rien ne gardait la trace qu'une recherche
 * avait eu lieu**, donc revenir sur l'accueil rendait une page vierge.
 *
 * Le mécanisme exact :
 *   · les résultats vivent dans un `useState` LOCAL de l'écran d'accueil ;
 *   · la recherche large d'atterrissage part d'un drapeau UNE-FOIS
 *     (`consumeBrowseOnLanding`), consommé au premier montage ;
 *   · une recherche large ne pose NI ville NI date, donc le brouillon
 *     (`search-draft`, lui, persistant) reste vide et ne peut rien rejouer.
 *
 * Les trois réunis : au moindre remontage de l'écran, l'état retombe au repos
 * et l'Expéditeur, qui avait des résultats, lit « Recherche un trajet… ».
 *
 * Ce module ne garde PAS les résultats — ils seraient périmés, et le serveur
 * est le seul à savoir ce qui est encore publié. Il garde **l'intention** :
 * ce qu'on avait demandé. L'écran la rejoue, et le serveur répond à jour.
 *
 * Mémoire de PROCESSUS, comme `welcome-state.ts` : volontairement non
 * persistée. Un lancement à froid repart de l'accueil, c'est le comportement
 * voulu ; ce qu'on répare, c'est la session en cours.
 *
 * ⚠️ CQS (règle du dépôt, D83) : `readLastSearch` répond sans jamais écrire.
 * La lecture qui normalise en répondant a déjà coûté un
 * « Cannot update a component while rendering a different component ».
 */

/** Ce qu'on avait demandé : assez pour rejouer, rien de plus. */
export type LastSearchIntent = {
  from?: string;
  to?: string;
  dateFrom?: string;
  dateTo?: string;
  mode: string;
  sort: string;
  weightKg?: number | null;
  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;
  families?: readonly string[];
};

let derniere: LastSearchIntent | null = null;

/** Retenir ce qui vient d'être demandé. Appelé à CHAQUE recherche lancée. */
export function rememberLastSearch(intent: LastSearchIntent): void {
  derniere = intent;
}

/** Ce qu'on avait demandé, ou `null` si rien n'a encore été cherché. */
export function readLastSearch(): LastSearchIntent | null {
  return derniere;
}

/** Oublier — la déconnexion, par exemple : les filtres de confiance et les
 *  résultats d'un membre n'ont pas à survivre à sa sortie. */
export function forgetLastSearch(): void {
  derniere = null;
}

/**
 * Faut-il rejouer la dernière recherche au montage de l'écran ?
 *
 * Deux conditions, et la seconde compte autant que la première : il faut une
 * intention mémorisée, ET un écran réellement AU REPOS. Rejouer par-dessus
 * des résultats déjà affichés provoquerait un clignotement — le défaut du
 * 11/10 que `keepResults` avait justement corrigé.
 */
export function shouldReplayLastSearch(
  intent: LastSearchIntent | null,
  etat: 'idle' | 'loading' | 'results' | 'error' | 'empty'
): boolean {
  return intent !== null && etat === 'idle';
}
