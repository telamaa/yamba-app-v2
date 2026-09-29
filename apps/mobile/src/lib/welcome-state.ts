/**
 * welcome-state.ts — la mémoire du « Continuer sans compte » (lot bienvenue).
 * ===========================================================================
 * VOLONTAIREMENT en mémoire de session d'app, pas persistée : à chaque
 * lancement à froid en anonyme, l'écran de bienvenue revient (le comportement
 * de la référence) ; le geste « passer » ne vaut que pour la session en cours.
 * Un membre connecté ne voit jamais l'écran — c'est la session qui décide,
 * pas ce drapeau.
 */
let dismissed = false;

export const isWelcomeDismissed = () => dismissed;

export const dismissWelcome = () => {
  dismissed = true;
};

/**
 * Le X de l'atterrissage → RÉSULTATS directs (motif Airbnb, arbitrage
 * expert du 28/09) : une jeune place de marché prouve la vie par de vrais
 * trajets, pas par un formulaire vide. Drapeau une-fois : l'onglet
 * Rechercher lance la recherche large À L'ARRIVÉE seulement — il garde son
 * état au repos le reste de la session.
 */
let browseOnLanding = false;

export const requestBrowseOnLanding = () => {
  browseOnLanding = true;
};

export const consumeBrowseOnLanding = (): boolean => {
  const value = browseOnLanding;
  browseOnLanding = false;
  return value;
};
