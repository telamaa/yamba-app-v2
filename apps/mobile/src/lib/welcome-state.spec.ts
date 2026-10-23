/**
 * welcome-state.spec.ts — « Continuer sans compte » et le X de l'atterrissage.
 * ============================================================================
 * Deux drapeaux de SESSION D'APP, volontairement non persistés : à chaque
 * lancement à froid en anonyme, l'écran de bienvenue revient. Le second
 * (`browseOnLanding`) est un signal UNE FOIS — l'onglet Rechercher lance la
 * recherche large à l'arrivée seulement, et garde son état au repos ensuite.
 */
import {
  consumeBrowseOnLanding,
  dismissWelcome,
  isWelcomeDismissed,
  requestBrowseOnLanding,
} from '@/lib/welcome-state';

describe('le geste « passer » ne vaut que pour la session en cours', () => {
  it('n’est pas posé au démarrage', () => {
    expect(isWelcomeDismissed()).toBe(false);
  });

  it('se pose une fois pour toutes, et n’a pas de retour en arrière', () => {
    dismissWelcome();
    expect(isWelcomeDismissed()).toBe(true);
    dismissWelcome();
    expect(isWelcomeDismissed()).toBe(true);
  });
});

describe('le X de l’atterrissage est un signal UNE FOIS', () => {
  it('ne se déclenche pas tout seul', () => {
    expect(consumeBrowseOnLanding()).toBe(false);
  });

  it('se consomme : la recherche large part à l’arrivée, pas à chaque retour d’onglet', () => {
    requestBrowseOnLanding();
    expect(consumeBrowseOnLanding()).toBe(true);
    expect(consumeBrowseOnLanding()).toBe(false);
  });

  it('deux demandes avant lecture ne font qu’une recherche', () => {
    requestBrowseOnLanding();
    requestBrowseOnLanding();
    expect(consumeBrowseOnLanding()).toBe(true);
    expect(consumeBrowseOnLanding()).toBe(false);
  });
});
