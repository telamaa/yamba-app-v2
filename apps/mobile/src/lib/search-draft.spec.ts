/**
 * search-draft.spec.ts — le brouillon de recherche et son SIGNAL de lancement.
 * ============================================================================
 * Même motif de mémoire de processus que le brouillon de réservation, plus une
 * idée à part : `submitNonce`. « Rechercher » ne peut pas être un booléen —
 * l'écran devrait l'acquitter, donc écrire à son tour, donc redessiner, donc
 * boucler. Un COMPTEUR se lit sans rien remettre à zéro, et deux recherches
 * identiques à la suite restent deux événements distincts. C'est ce qu'on
 * vérifie ici.
 */
import {
  clearSearchDraft,
  getSearchDraft,
  requestSearch,
  setSearchDraft,
  subscribeSearchDraft,
  swapSearchDraft,
} from '@/lib/search-draft';
import { makeExact } from '@/lib/search-date';

beforeEach(() => {
  clearSearchDraft();
});

describe('les écritures', () => {
  it('la référence est stable tant que rien ne change', () => {
    expect(getSearchDraft()).toBe(getSearchDraft());
  });

  it('une page poussée écrit, se referme, l’écran lit', () => {
    setSearchDraft({ from: 'Paris, France' });
    setSearchDraft({ to: 'Brazzaville, Congo' });
    expect(getSearchDraft().from).toBe('Paris, France');
    expect(getSearchDraft().to).toBe('Brazzaville, Congo');
  });

  it('les abonnés sont prévenus, et se désabonnent vraiment', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSearchDraft(listener);
    setSearchDraft({ from: 'Paris' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setSearchDraft({ from: 'Lyon' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('« Tout effacer » efface les trois champs, PAS le compteur', () => {
  it('garde le nonce : l’effacement n’est pas une recherche', () => {
    setSearchDraft({ from: 'Paris', to: 'Brazzaville', date: makeExact(new Date(2027, 2, 15)) });
    requestSearch();
    const nonce = getSearchDraft().submitNonce;
    clearSearchDraft();
    const draft = getSearchDraft();
    expect([draft.from, draft.to, draft.date]).toEqual(['', '', null]);
    expect(draft.submitNonce).toBe(nonce);
  });
});

describe('requestSearch — un compteur, pas un booléen', () => {
  it('avance de un à chaque demande', () => {
    const before = getSearchDraft().submitNonce;
    requestSearch();
    requestSearch();
    expect(getSearchDraft().submitNonce).toBe(before + 2);
  });

  it('deux recherches IDENTIQUES à la suite restent deux événements', () => {
    setSearchDraft({ from: 'Paris', to: 'Brazzaville' });
    requestSearch();
    const first = getSearchDraft().submitNonce;
    requestSearch();
    expect(getSearchDraft().submitNonce).toBe(first + 1);
  });

  it('ne touche à aucun champ de saisie', () => {
    setSearchDraft({ from: 'Paris', to: 'Brazzaville' });
    requestSearch();
    expect(getSearchDraft().from).toBe('Paris');
    expect(getSearchDraft().to).toBe('Brazzaville');
  });
});

describe('swapSearchDraft — le bouton circulaire', () => {
  it('échange départ et destination', () => {
    setSearchDraft({ from: 'Paris', to: 'Brazzaville' });
    swapSearchDraft();
    expect(getSearchDraft().from).toBe('Brazzaville');
    expect(getSearchDraft().to).toBe('Paris');
  });

  it('échange aussi quand un seul champ est rempli — l’inversion reste un geste', () => {
    setSearchDraft({ from: 'Paris', to: '' });
    swapSearchDraft();
    expect(getSearchDraft().from).toBe('');
    expect(getSearchDraft().to).toBe('Paris');
  });

  it('ne lance PAS de recherche', () => {
    const nonce = getSearchDraft().submitNonce;
    swapSearchDraft();
    expect(getSearchDraft().submitNonce).toBe(nonce);
  });
});
