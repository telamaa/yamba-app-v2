/**
 * en-tete-sous-la-barre.spec.ts — un en-tête ne dépend plus d'une mesure (D107).
 * ===============================================================================
 * Retour de recette : « le from est TOUJOURS trop haut sur certaines pages ».
 * « Toujours », c'est-à-dire APRÈS le correctif de D103 1A, fusionné le matin
 * même — capture horodatée à 13:29 à l'appui.
 *
 * Le `SafeAreaProvider` manquait réellement (vingt-cinq consommateurs sans
 * aucun) et sa pose reste juste. **Elle n'a pas suffi.** Le diagnostic était
 * vraisemblable et il était faux — exactement le piège décrit au chapitre 244,
 * trois lots plus tôt, par moi.
 *
 * La décision n'est donc plus de trouver pourquoi la mesure échoue : c'est de
 * ne plus en dépendre.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { plancherHaut } from '@/lib/top-inset';

const SRC = resolve(__dirname, '..');

describe('plancherHaut — deux sources, et chacune peut mentir', () => {
  it('prend la plus grande des deux', () => {
    expect(plancherHaut(59, 59)).toBe(59);
    expect(plancherHaut(20, 59)).toBe(59);
    expect(plancherHaut(59, 20)).toBe(59);
  });

  it('un inset à ZÉRO ne fait plus coller l’en-tête à la barre', () => {
    // Le défaut exact : dans la pile `transparentModal`, l'inset mesuré rend
    // zéro, et le titre se posait sur l'horloge.
    expect(plancherHaut(0, 59)).toBe(59);
  });

  it('une hauteur de barre absente laisse parler l’inset', () => {
    // L'inverse doit tenir aussi : `Constants.statusBarHeight` peut manquer
    // selon la plateforme, et ce n'est pas une raison de tout perdre.
    expect(plancherHaut(59, 0)).toBe(59);
    expect(plancherHaut(59, null)).toBe(59);
    expect(plancherHaut(59, undefined)).toBe(59);
  });

  it('les deux muettes rendent zéro, sans lever', () => {
    // Pas de valeur inventée : si les deux sources se taisent, on n'ajoute
    // rien plutôt que d'imposer une marge arbitraire.
    expect(plancherHaut(0, 0)).toBe(0);
    expect(plancherHaut(null, undefined)).toBe(0);
  });

  it('une valeur ABERRANTE vaut silence, pas confiance', () => {
    // Un inset négatif ou NaN se propagerait en `paddingTop` et casserait la
    // mise en page plus sûrement que le défaut d'origine.
    expect(plancherHaut(-10, 59)).toBe(59);
    expect(plancherHaut(Number.NaN, 59)).toBe(59);
    expect(plancherHaut(Number.POSITIVE_INFINITY, 59)).toBe(59);
    expect(plancherHaut(-10, -10)).toBe(0);
  });
});

describe('le hook branche les deux sources, et n’en invente pas une troisième', () => {
  const hook = readFileSync(join(SRC, 'hooks/use-top-inset.ts'), 'utf8');

  it('il lit l’inset MESURÉ', () => {
    expect(hook).toContain('useSafeAreaInsets()');
  });

  it('il lit la hauteur de barre de l’APPAREIL', () => {
    // Elle ne dépend d'aucun arbre de contexte React : c'est ce qui en fait
    // le filet de sécurité de l'inset, qui lui en dépend.
    expect(hook).toContain('Constants.statusBarHeight');
  });

  it('il ne décide de rien lui-même', () => {
    // La règle est pure et vit dans `lib/`, donc sous le harnais. Le hook
    // n'est qu'un câblage.
    expect(hook).toContain('plancherHaut(');
  });

  it('AUCUN nombre en dur — ni 20, ni 44, ni 59', () => {
    // Un plancher fixe serait faux sur la moitié du parc : 20 pt sur un
    // iPhone SE, 59 sur un appareil à Dynamic Island. C'est précisément
    // pourquoi on préfère une valeur fournie par l'appareil.
    expect(hook).not.toMatch(/\b(20|44|59)\b/);
    expect(readFileSync(join(SRC, 'lib/top-inset.ts'), 'utf8')).not.toMatch(
      /Math\.max\([^)]*\b\d{2}\b/
    );
  });
});

describe('les écrans poussés de l’éditeur l’utilisent', () => {
  /**
   * La page VILLE a changé d'adresse (lot « Publier ») : son geste vit
   * maintenant dans `components/city-picker.tsx`, que DEUX routes consomment
   * — la recherche et la publication. Les règles de bord haut s'y vérifient
   * donc une fois pour les deux, et la ROUTE reste vérifiée pour ce qui lui
   * revient : passer le plancher au composant.
   */
  const ecrans = [
    ['ville', join(SRC, 'components/city-picker.tsx')],
    ['date', join(SRC, 'app/search/date.tsx')],
  ] as const;

  const routes = [
    ['ville (recherche)', join(SRC, 'app/search/city.tsx')],
    ['ville (publication)', join(SRC, 'app/publish-trip/city.tsx')],
    ['date', join(SRC, 'app/search/date.tsx')],
  ] as const;

  it.each(routes)('%s consomme le plancher', (_nom, chemin) => {
    expect(readFileSync(chemin, 'utf8')).toContain('useTopInset()');
  });

  it.each(ecrans)('%s ne confie plus le bord HAUT à SafeAreaView', (_nom, chemin) => {
    // C'est la mesure qui échouait : la lui redemander ne servirait à rien,
    // et laisserait croire que le bord est traité deux fois.
    const source = readFileSync(chemin, 'utf8');
    const debut = source.indexOf('<SafeAreaView');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = source.indexOf('>', debut);
    expect(fin).toBeGreaterThan(debut);
    expect(source.slice(debut, fin)).not.toContain("'top'");
  });

  it.each(ecrans)('%s applique la marge à son en-tête', (_nom, chemin) => {
    expect(readFileSync(chemin, 'utf8')).toContain('paddingTop: topInset');
  });
});
