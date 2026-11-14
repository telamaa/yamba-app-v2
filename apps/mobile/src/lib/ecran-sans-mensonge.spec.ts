/**
 * ecran-sans-mensonge.spec.ts — un écran n'affirme rien qu'il n'applique (D100).
 * ==============================================================================
 * Quatre défauts trouvés le 14/11/2026 en comparant les deux écrans À LA
 * RÉPONSE DU SERVEUR, et non le code à lui-même. Aucun n'était visible en
 * relisant un seul front :
 *
 *   1A/1B — le tri coché n'était pas le tri envoyé ;
 *   2A    — la mention nommait un poids que le prix ne facture pas ;
 *   3A    — un séparateur ponctuait le vide ;
 *   4A    — « 1 vue » publiait l'impopularité d'une offre, et les deux fronts
 *           n'avaient pas le même seuil.
 *
 * Les fiches ci-dessous épinglent ce qui SURVIT à un changement d'avis : la
 * liste des tris confrontée au CONTRAT, l'absence de l'omission qui a causé le
 * défaut, et l'égalité des deux fronts. Pas la formulation du jour.
 *
 * Le contrat et le site sont lus avec `readFileSync`, jamais importés : un
 * `import` par-dessus la frontière d'un projet est une dépendance de BUILD
 * (D93), et `nx test` construirait alors user-ui avant de jouer ces fiches.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { BILLING_FLOOR_KG, billedKg } from '@/lib/pricing-example';
import { MIN_SHOWN_VIEWS, showsViews } from '@/lib/trip-format';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');
const TRIP_SERVICE = resolve(MOBILE, '../trip-service');

/** Les valeurs d'une liste TypeScript `const X = ['a', 'b'] as const` ou d'une union. */
function litLesValeurs(source: string, ancre: string): string[] {
  const debut = source.indexOf(ancre);
  expect(debut).toBeGreaterThanOrEqual(0); // D98 — sans cette garde, la tranche serait VIDE
  const fin = source.indexOf(';', debut);
  expect(fin).toBeGreaterThan(debut);
  const tranche = source.slice(debut, fin);
  return [...tranche.matchAll(/["']([a-zA-Z]+)["']/g)].map((m) => m[1]);
}

describe('1A/1B — le tri affiché est le tri appliqué', () => {
  const contrat = readFileSync(join(TRIP_SERVICE, 'src/dto/trip-search.dto.ts'), 'utf8');
  const apiMobile = readFileSync(join(MOBILE, 'src/lib/api/search.api.ts'), 'utf8');
  const typesWeb = readFileSync(join(WEB, 'src/components/search/search-results.types.ts'), 'utf8');

  it('le serveur a bien QUATRE tris, et `relevance` en tête', () => {
    const options = litLesValeurs(contrat, 'export const SORT_OPTIONS');
    expect(options).toEqual(['relevance', 'earliest', 'lowestPrice', 'bestRated']);
  });

  it('les deux fronts exposent EXACTEMENT les tris du contrat', () => {
    // Le défaut : les fronts n'en offraient que trois sur quatre, si bien que
    // le défaut du serveur était inatteignable depuis l'interface — appliqué
    // sans être nommé, et impossible à retrouver une fois quitté.
    const duContrat = litLesValeurs(contrat, 'export const SORT_OPTIONS');
    expect(litLesValeurs(apiMobile, 'export type SearchSort')).toEqual(duContrat);
    expect(litLesValeurs(typesWeb, 'export type SortOption')).toEqual(duContrat);
  });

  it('aucun front n’OMET le paramètre de tri', () => {
    // La cause exacte, des deux côtés : `if (sort !== 'earliest') …`, écrit
    // quand `earliest` était encore le défaut du serveur. D80 l'a changé en
    // `relevance` ; personne n'a touché aux deux clients.
    const apiWeb = readFileSync(join(WEB, 'src/services/trip.api.ts'), 'utf8');
    for (const source of [apiMobile, apiWeb]) {
      expect(source).not.toMatch(/sort\s*!==\s*["']earliest["']/);
      expect(source).toMatch(/if \(params\.sort\)/);
    }
  });

  it('les deux fronts démarrent sur le défaut du CONTRAT', () => {
    const ecranMobile = readFileSync(join(MOBILE, 'src/app/(tabs)/index.tsx'), 'utf8');
    const ecranWeb = readFileSync(join(WEB, 'src/components/search/SearchResultsView.tsx'), 'utf8');
    expect(ecranMobile).toMatch(/useState<SearchSort>\('relevance'\)/);
    expect(ecranWeb).toMatch(/useState<SortOption>\("relevance"\)/);
  });
});

describe('2A — la mention nomme le poids que le prix FACTURE', () => {
  it('sous le plancher, le poids facturé est le plancher', () => {
    // Le défaut mesuré : site à 1,5 kg et téléphone à 2 kg affichaient le même
    // 24,85 €. Le curseur semblait inerte parce que la carte nommait le poids
    // CHOISI à côté du prix du poids FACTURÉ.
    expect(billedKg(0.2)).toBe(BILLING_FLOOR_KG);
    expect(billedKg(1.5)).toBe(BILLING_FLOOR_KG);
    expect(billedKg(2)).toBe(BILLING_FLOOR_KG);
  });

  it('au-dessus du plancher, le poids du colis est celui qu’on paie', () => {
    expect(billedKg(2.3)).toBe(2.3);
    expect(billedKg(5)).toBe(5);
    expect(billedKg(23)).toBe(23);
  });

  it('les TROIS cartes du produit passent par cette règle', () => {
    const cartes = [
      join(MOBILE, 'src/components/trip-result-card.tsx'),
      join(WEB, 'src/components/search/TripResultCard.tsx'),
      join(WEB, 'src/components/search/TripResultCardMobile.tsx'),
    ];
    for (const carte of cartes) {
      expect(readFileSync(carte, 'utf8')).toContain('billedKg(');
    }
  });
});

describe('3A — un séparateur ne ponctue que s’il sépare', () => {
  const carte = readFileSync(join(MOBILE, 'src/components/trip-result-card.tsx'), 'utf8');

  it('le point vit DANS la branche qui porte la note', () => {
    // On vise l'usage, pas le mot (leçon payée trois fois en novembre) : le
    // séparateur doit apparaître APRÈS l'ouverture de la branche « a une note ».
    const branche = carte.indexOf("typeof trip.rating === 'number' ?");
    const separateur = carte.indexOf('> · <');
    expect(branche).toBeGreaterThanOrEqual(0);
    expect(separateur).toBeGreaterThan(branche);
  });

  it('un Voyageur SANS note n’emporte aucun séparateur', () => {
    // Le rendu n'est pas joué ici (frontière assumée du harnais, A223) : on
    // garde la structure qui rendait le défaut possible — un point rendu
    // au même niveau que le nom, hors de toute condition.
    const nom = carte.indexOf('{trip.travelerFirstName}');
    const separateur = carte.indexOf('> · <');
    const entreLesDeux = carte.slice(nom, separateur);
    expect(entreLesDeux).toContain("typeof trip.rating === 'number'");
  });
});

describe('4A — un compteur de vues sous son seuil dessert le trajet', () => {
  it('le seuil du téléphone est celui du site', () => {
    const signauxWeb = readFileSync(join(WEB, 'src/lib/trip-signals.ts'), 'utf8');
    const duSite = signauxWeb.match(/MIN_SHOWN_VIEWS\s*=\s*(\d+)/);
    expect(duSite).not.toBeNull();
    expect(Number(duSite?.[1])).toBe(MIN_SHOWN_VIEWS);
  });

  it('« 1 vue » ne s’affiche plus — c’était publier l’impopularité d’une offre', () => {
    expect(showsViews(1)).toBe(false);
    expect(showsViews(14)).toBe(false);
    expect(showsViews(MIN_SHOWN_VIEWS)).toBe(true);
  });

  it('les deux cartes du site passent par le seuil, et non par « > 0 »', () => {
    for (const carte of ['TripResultCard.tsx', 'TripResultCardMobile.tsx']) {
      const source = readFileSync(join(WEB, 'src/components/search', carte), 'utf8');
      expect(source).toContain('showsViews(item.viewsCount)');
      expect(source).not.toMatch(/item\.viewsCount\s*>\s*0/);
    }
  });
});
