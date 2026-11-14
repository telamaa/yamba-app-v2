/**
 * search-facets.spec.ts — un compteur à zéro se lit pareil partout (D100 5A).
 * ===========================================================================
 * Au 14/11/2026, trois traitements d'un même zéro coexistaient dans le produit :
 * le téléphone estompait l'onglet de mode en le gardant tapable, le site
 * DÉSACTIVAIT les familles, et le site ne faisait RIEN sur ses onglets de mode
 * (« Train 0 », « Voiture 0 » au poids plein, menant au vide).
 *
 * La règle vit maintenant dans un module pur que les deux fronts recopient.
 * Cette fiche garde les trois choses qui peuvent redériver : la règle
 * elle-même, l'identité des deux copies, et le fait que les composants la
 * CONSOMMENT au lieu de la réécrire — c'est par là que le site l'avait ratée.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { EMPTY_FACET_OPACITY, isEmptyFacet } from '@/lib/search-facets';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

describe('isEmptyFacet — la règle', () => {
  it('une facette sans résultat s’efface', () => {
    expect(isEmptyFacet(0, false)).toBe(true);
  });

  it('une facette ACTIVE ne s’efface jamais, même à zéro', () => {
    // C'est celle qu'on vient de choisir : l'effacer rendrait l'état de
    // l'écran illisible au moment précis où il change.
    expect(isEmptyFacet(0, true)).toBe(false);
  });

  it('une facette qui a de l’offre garde son poids', () => {
    expect(isEmptyFacet(3, false)).toBe(false);
    expect(isEmptyFacet(3, true)).toBe(false);
  });

  it('un compteur ABSENT n’est pas un compteur à zéro', () => {
    // Le serveur peut ne pas servir la facette (chargement, contrat plus
    // ancien) : ne rien savoir n'est pas savoir qu'il n'y a rien.
    expect(isEmptyFacet(null, false)).toBe(false);
    expect(isEmptyFacet(undefined, false)).toBe(false);
  });

  it('l’opacité reste assez présente pour rester une porte', () => {
    // La valeur est le contrat visuel partagé ; elle est lue par le style
    // natif ET par le style en ligne du site.
    expect(EMPTY_FACET_OPACITY).toBe(0.5);
    expect(EMPTY_FACET_OPACITY).toBeGreaterThan(0.3);
    expect(EMPTY_FACET_OPACITY).toBeLessThan(1);
  });
});

describe('les deux copies de la règle sont la MÊME', () => {
  it('octet pour octet', () => {
    const ici = readFileSync(join(MOBILE, 'src/lib/search-facets.ts'), 'utf8');
    const la = readFileSync(join(WEB, 'src/lib/search-facets.ts'), 'utf8');
    expect(la).toBe(ici);
  });
});

describe('les écrans CONSOMMENT la règle, ils ne la réécrivent pas', () => {
  // Le défaut d'origine n'était pas une mauvaise règle : c'était une bonne
  // règle écrite DANS un composant, donc invisible à l'autre front. On vise
  // donc l'usage, et on interdit le retour de la valeur en dur.
  const ecrans = [
    ['téléphone — flux d’atterrissage', join(MOBILE, 'src/app/(tabs)/index.tsx')],
    ['site — onglets de mode', join(WEB, 'src/components/search/TransportModeTabs.tsx')],
    ['site — panneau de filtres', join(WEB, 'src/components/search/SearchFiltersSidebar.tsx')],
  ] as const;

  it.each(ecrans)('%s importe et appelle la règle', (_nom, chemin) => {
    const source = readFileSync(chemin, 'utf8');
    expect(source).toContain('search-facets');
    expect(source).toContain('isEmptyFacet(');
  });

  it.each(ecrans)('%s ne réécrit pas l’opacité en dur', (_nom, chemin) => {
    const source = readFileSync(chemin, 'utf8');
    // `opacity: 0.5` / `opacity-50` : la valeur recopiée est exactement ce qui
    // avait permis aux deux fronts de diverger sans que rien ne le dise.
    expect(source).not.toMatch(/opacity:\s*0\.5\b/);
    expect(source).not.toContain('opacity-50');
  });

  it('le site n’enferme plus l’Expéditeur en DÉSACTIVANT une facette à zéro', () => {
    const source = readFileSync(join(WEB, 'src/components/search/SearchFiltersSidebar.tsx'), 'utf8');
    // Une facette à zéro reste le chemin de SORTIE du filtre qu'on vient de
    // poser : elle doit rester activable.
    expect(source).not.toContain('cursor-not-allowed');
  });
});
