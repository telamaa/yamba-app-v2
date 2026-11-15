/**
 * last-search.spec.ts — revenir ne doit pas tout effacer (D106).
 * ===============================================================
 * Retour de recette : « certains retours me renvoient vers cette page qui
 * n'est pas conforme » — l'accueil AU REPOS, pastille « Partout · Toutes les
 * dates », alors que l'Expéditeur avait des résultats à l'écran.
 *
 * Le défaut tenait à TROIS mécanismes justes pris séparément :
 *   · les résultats vivent dans un `useState` local de l'écran ;
 *   · la recherche large d'atterrissage part d'un drapeau UNE-FOIS, consommé ;
 *   · une recherche large ne pose ni ville ni date, donc le brouillon
 *     persistant reste vide et ne peut rien rejouer.
 *
 * Rien ne gardait la trace qu'une recherche avait eu lieu.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  forgetLastSearch,
  readLastSearch,
  rememberLastSearch,
  shouldReplayLastSearch,
  type LastSearchIntent,
} from '@/lib/last-search';

const SRC = resolve(__dirname, '..');

const large: LastSearchIntent = { mode: 'all', sort: 'relevance' };

beforeEach(forgetLastSearch);

describe('la mémoire retient ce qu’on a demandé', () => {
  it('rien n’est retenu tant que rien n’a été cherché', () => {
    expect(readLastSearch()).toBeNull();
  });

  it('une recherche LARGE est retenue — c’est tout le sujet', () => {
    // Elle ne pose ni ville ni date : c'est précisément celle que le
    // brouillon ne pouvait pas représenter, donc celle qu'on perdait.
    rememberLastSearch(large);
    expect(readLastSearch()).toEqual(large);
  });

  it('elle retient les FILTRES, pas seulement le corridor', () => {
    const fine: LastSearchIntent = {
      from: 'Paris',
      to: 'Brazzaville',
      mode: 'plane',
      sort: 'earliest',
      weightKg: 5,
      superTripper: true,
      families: ['DOCUMENTS_PAPERS'],
    };
    rememberLastSearch(fine);
    expect(readLastSearch()).toEqual(fine);
  });

  it('la dernière écrase la précédente', () => {
    rememberLastSearch(large);
    rememberLastSearch({ mode: 'train', sort: 'lowestPrice' });
    expect(readLastSearch()?.mode).toBe('train');
  });

  it('lire ne modifie RIEN — CQS', () => {
    // Règle du dépôt (D83) : une fonction qui répond à une question n'écrit
    // jamais. Une lecture qui normalisait en répondant avait provoqué
    // « Cannot update a component while rendering a different component ».
    rememberLastSearch(large);
    const a = readLastSearch();
    const b = readLastSearch();
    expect(a).toEqual(b);
    expect(readLastSearch()).toEqual(large);
  });
});

describe('shouldReplayLastSearch — rejouer, mais pas n’importe quand', () => {
  it('on rejoue quand l’écran est AU REPOS et qu’on avait cherché', () => {
    expect(shouldReplayLastSearch(large, 'idle')).toBe(true);
  });

  it('on ne rejoue rien si rien n’a été cherché', () => {
    expect(shouldReplayLastSearch(null, 'idle')).toBe(false);
  });

  it('on ne rejoue JAMAIS par-dessus un écran qui travaille ou qui montre', () => {
    // Rejouer sur des résultats déjà affichés provoquerait le clignotement du
    // 11/10, que `keepResults` avait justement corrigé.
    for (const etat of ['loading', 'results', 'error', 'empty'] as const) {
      expect(shouldReplayLastSearch(large, etat)).toBe(false);
    }
  });
});

describe('la mémoire s’efface avec la session', () => {
  it('oublier rend la mémoire vide', () => {
    rememberLastSearch(large);
    forgetLastSearch();
    expect(readLastSearch()).toBeNull();
  });

  it('la déconnexion appelle bien l’oubli', () => {
    // Une recherche peut porter des filtres de confiance et un corridor qui
    // disent quelque chose de celui qui partait : ils n'ont pas à s'afficher
    // au visiteur suivant sur le même téléphone.
    const session = readFileSync(join(SRC, 'lib/session-context.tsx'), 'utf8');
    const debut = session.indexOf('const signOut');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = session.indexOf('}, [setPreferredLocale]);', debut);
    expect(fin).toBeGreaterThan(debut);
    expect(session.slice(debut, fin)).toContain('forgetLastSearch()');
  });

  it('elle n’est PAS persistée — un lancement à froid repart de l’accueil', () => {
    // Même doctrine que `welcome-state.ts` : mémoire de PROCESSUS. Si un
    // stockage apparaît ici, c'est une décision, pas un détail.
    const source = readFileSync(join(SRC, 'lib/last-search.ts'), 'utf8');
    expect(source).not.toContain('AsyncStorage');
    expect(source).not.toContain('SecureStore');
    expect(source).not.toContain('localStorage');
  });
});

describe('l’écran consomme bien la mémoire', () => {
  const ecran = readFileSync(join(SRC, 'app/(tabs)/index.tsx'), 'utf8');

  it('chaque recherche lancée est retenue', () => {
    const debut = ecran.indexOf('const runSearchWith');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = ecran.indexOf('setState({ kind: ', debut);
    expect(fin).toBeGreaterThan(debut);
    expect(ecran.slice(debut, fin)).toContain('rememberLastSearch(');
  });

  it('le montage rejoue, et seulement APRÈS le drapeau d’atterrissage', () => {
    // L'ordre compte : la recherche large d'atterrissage a sa propre raison
    // d'être (motif Airbnb) et ne doit pas être doublée par un rejeu.
    const atterrissage = ecran.indexOf('consumeBrowseOnLanding()');
    const rejeu = ecran.indexOf('shouldReplayLastSearch(');
    expect(atterrissage).toBeGreaterThanOrEqual(0);
    expect(rejeu).toBeGreaterThan(atterrissage);
  });
});
