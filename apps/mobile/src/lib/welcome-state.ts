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
