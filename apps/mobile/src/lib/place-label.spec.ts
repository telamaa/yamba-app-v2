/**
 * place-label.spec.ts — lire une suggestion de ville (lot « Publier »).
 * ======================================================================
 * La règle existait depuis A211 et n'était vérifiée par RIEN : elle vivait
 * dans `api/places.api.ts`, inatteignable depuis le harnais (`expo-constants`
 * dans la chaîne d'import). Elle décide pourtant de ce que le SERVEUR reçoit
 * — `placeSearchTerm` ne garde que le premier segment avant la virgule, et
 * sans cette normalisation toute ville étrangère rendait zéro résultat
 * (WEB-ACC-9). Déplacée dans un module pur par ce lot, la voici gardée.
 */
import { placeCountry, placeLabel } from '@/lib/place-label';

describe('le pays d’une suggestion', () => {
  it('est le DERNIER segment du contexte', () => {
    expect(placeCountry({ main: 'Paris', secondary: 'France' })).toBe('France');
    expect(placeCountry({ main: 'Austin', secondary: 'Texas, États-Unis' })).toBe('États-Unis');
    expect(placeCountry({ main: 'Beauvais', secondary: "Route de l'Aéroport, Tillé, France" })).toBe(
      'France'
    );
  });

  it('reste VIDE quand Google n’en donne pas — on n’invente pas un pays', () => {
    // Divergence assumée avec le site, qui replie sur « France » parce que
    // son SDK est chargé `region=FR`. Notre relais n'a pas ce biais.
    expect(placeCountry({ main: 'Paris', secondary: '' })).toBe('');
    expect(placeCountry({ main: 'Paris', secondary: '  ,  ' })).toBe('');
  });

  it('ne répète pas la ville quand le contexte la redit', () => {
    expect(placeCountry({ main: 'Singapour', secondary: 'Singapour' })).toBe('');
  });
});

describe('le libellé normalisé', () => {
  it('s’écrit « Ville, Pays »', () => {
    expect(placeLabel({ main: 'Paris', secondary: 'France' })).toBe('Paris, France');
    expect(placeLabel({ main: 'Austin', secondary: 'Texas, États-Unis' })).toBe(
      'Austin, États-Unis'
    );
  });

  it('se réduit à la ville seule quand le pays manque', () => {
    expect(placeLabel({ main: 'Paris', secondary: '' })).toBe('Paris');
    expect(placeLabel({ main: 'Singapour', secondary: 'Singapour' })).toBe('Singapour');
  });

  it('garde la VILLE en premier segment — c’est elle que le serveur lit', () => {
    // La recherche serveur coupe à la première virgule : si le libellé
    // commençait par le pays, toute recherche deviendrait un pays.
    for (const cas of [
      { main: 'Dubaï', secondary: 'Émirats arabes unis' },
      { main: 'Brazzaville', secondary: 'République du Congo' },
    ]) {
      expect(placeLabel(cas).split(',')[0]).toBe(cas.main);
    }
  });
});
