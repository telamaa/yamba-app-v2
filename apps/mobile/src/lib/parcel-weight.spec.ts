/**
 * parcel-weight.spec.ts — le colis de l'Expéditeur, et qui sait l'envoyer (D101).
 * ===============================================================================
 * Le défaut d'origine n'était pas un filtre mal fichu : le client mobile
 * **n'avait pas de champ `weightKg`** et posait `estimateKg` en dur. La carte
 * affirmait donc « estimation pour 2 kg » sans qu'aucun écran ne puisse voir
 * ni changer ce 2.
 *
 * Les cinq fiches de parité existantes étaient toutes VERTES pendant ce
 * temps : elles comparaient des règles, des clés, des seuils, un ordre — pas
 * ce que chaque front sait ÉMETTRE. C'est la vérification qui manquait, et le
 * dernier bloc de ce fichier la porte.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  MAX_PARCEL_KG,
  MIN_PARCEL_KG,
  PARCEL_PRESETS_KG,
  PARCEL_STEP_KG,
  canStepParcelKg,
  clampParcelKg,
  formatParcelKg,
  stepParcelKg,
} from '@/lib/parcel-weight';
import { PRICING_EXAMPLE_PARAMS } from '@/lib/pricing-example';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

describe('le domaine du colis', () => {
  it('les bornes encadrent le colis par défaut', () => {
    // Le colis supposé doit être ATTEIGNABLE au pas-à-pas, sans quoi on ne
    // pourrait jamais revenir à ce que la carte annonçait.
    expect(MIN_PARCEL_KG).toBeLessThanOrEqual(PRICING_EXAMPLE_PARAMS.exampleWeightKg);
    expect(MAX_PARCEL_KG).toBeGreaterThan(PRICING_EXAMPLE_PARAMS.exampleWeightKg);
    expect(clampParcelKg(PRICING_EXAMPLE_PARAMS.exampleWeightKg)).toBe(
      PRICING_EXAMPLE_PARAMS.exampleWeightKg
    );
  });

  it('chaque valeur d’usage est dans le domaine et sur un cran', () => {
    for (const preset of PARCEL_PRESETS_KG) {
      expect(clampParcelKg(preset)).toBe(preset);
    }
  });
});

describe('clampParcelKg — on ne sort jamais du domaine', () => {
  it('rabat sous la borne basse et au-dessus de la haute', () => {
    expect(clampParcelKg(0)).toBe(MIN_PARCEL_KG);
    expect(clampParcelKg(-12)).toBe(MIN_PARCEL_KG);
    expect(clampParcelKg(999)).toBe(MAX_PARCEL_KG);
  });

  it('aligne sur le cran le plus proche', () => {
    expect(clampParcelKg(1.2)).toBe(1);
    expect(clampParcelKg(1.3)).toBe(1.5);
    expect(clampParcelKg(2.74)).toBe(2.5);
  });

  it('ne laisse jamais échapper un flottant', () => {
    // `Math.round(x / 0.5) * 0.5` rouvre des 2.4000000000000004, qui
    // s'afficheraient tels quels dans la feuille.
    for (let kg = MIN_PARCEL_KG; kg <= MAX_PARCEL_KG; kg += PARCEL_STEP_KG) {
      const valeur = clampParcelKg(kg);
      expect(Number.isInteger(valeur * 10)).toBe(true);
    }
  });
});

describe('stepParcelKg — le pas-à-pas', () => {
  it('avance et recule d’un cran', () => {
    expect(stepParcelKg(2, 1)).toBe(2.5);
    expect(stepParcelKg(2, -1)).toBe(1.5);
  });

  it('bute sur les bornes au lieu de les franchir', () => {
    expect(stepParcelKg(MIN_PARCEL_KG, -1)).toBe(MIN_PARCEL_KG);
    expect(stepParcelKg(MAX_PARCEL_KG, 1)).toBe(MAX_PARCEL_KG);
  });

  it('canStep dit quand le bouton doit s’éteindre', () => {
    expect(canStepParcelKg(MIN_PARCEL_KG, -1)).toBe(false);
    expect(canStepParcelKg(MIN_PARCEL_KG, 1)).toBe(true);
    expect(canStepParcelKg(MAX_PARCEL_KG, 1)).toBe(false);
    expect(canStepParcelKg(MAX_PARCEL_KG, -1)).toBe(true);
  });
});

describe('formatParcelKg — le nombre suit la LANGUE, pas un pays en dur', () => {
  it('sépare les décimales selon la langue', () => {
    // Le défaut corrigé : `toLocaleString("fr-FR")` écrit en dur côté site,
    // donc « 1,5 kg » jusque dans l'interface anglaise.
    expect(formatParcelKg(1.5, 'fr-FR')).toBe('1,5');
    expect(formatParcelKg(1.5, 'en-US')).toBe('1.5');
  });

  it('n’affiche pas de décimale inutile', () => {
    expect(formatParcelKg(2, 'fr-FR')).toBe('2');
    expect(formatParcelKg(20, 'en-US')).toBe('20');
  });
});

describe('les deux copies du domaine sont la MÊME', () => {
  it('octet pour octet', () => {
    const ici = readFileSync(join(MOBILE, 'src/lib/parcel-weight.ts'), 'utf8');
    const la = readFileSync(join(WEB, 'src/lib/parcel-weight.ts'), 'utf8');
    expect(la).toBe(ici);
  });

  it('le site ne garde aucune borne en dur dans son JSX', () => {
    const panneau = readFileSync(
      join(WEB, 'src/components/search/SearchFiltersSidebar.tsx'),
      'utf8'
    );
    expect(panneau).toContain('MIN_PARCEL_KG');
    expect(panneau).toContain('MAX_PARCEL_KG');
    expect(panneau).toContain('PARCEL_STEP_KG');
    expect(panneau).not.toMatch(/min=\{0\.5\}/);
    expect(panneau).not.toMatch(/max=\{30\}/);
  });

  it('aucun front ne fige « fr-FR » pour écrire un poids', () => {
    for (const chemin of [
      join(WEB, 'src/components/search/SearchFiltersSidebar.tsx'),
      join(MOBILE, 'src/app/(tabs)/index.tsx'),
    ]) {
      expect(readFileSync(chemin, 'utf8')).not.toContain('toLocaleString("fr-FR")');
    }
  });
});

describe('QUI sait émettre le poids — la vérification qui manquait', () => {
  const apiMobile = readFileSync(join(MOBILE, 'src/lib/api/search.api.ts'), 'utf8');
  const apiWeb = readFileSync(join(WEB, 'src/services/trip.api.ts'), 'utf8');

  it('les deux clients savent envoyer `weightKg`', () => {
    // Le défaut : zéro occurrence côté mobile. Le type ne l'offrait même pas,
    // donc aucun écran ne pouvait le poser — et aucune fiche ne le disait.
    expect(apiMobile).toContain("query.set('weightKg'");
    expect(apiWeb).toMatch(/qs\.set\("weightKg"/);
  });

  it('l’écran natif tient un état de poids et le passe à CHAQUE recherche', () => {
    const ecran = readFileSync(join(MOBILE, 'src/app/(tabs)/index.tsx'), 'utf8');
    expect(ecran).toMatch(/useState<number \| null>\(null\)/);
    // Six appels construisent des paramètres ; seul celui de l'atterrissage
    // part sans poids (rien n'est encore choisi).
    const avecPoids = [...ecran.matchAll(/paramsFor\(\{[^}]*weightKg[^}]*\}\)/g)].length;
    expect(avecPoids).toBeGreaterThanOrEqual(5);
  });

  it('le poids CHOISI et le poids SUPPOSÉ ne partent jamais ensemble', () => {
    // D99 3C : `weightKg` filtre ET enrichit, `estimateKg` enrichit seulement.
    // Les cumuler retirerait des trajets d'une page qui promet « tous ».
    const debut = apiMobile.indexOf("if (typeof params.weightKg === 'number')");
    expect(debut).toBeGreaterThanOrEqual(0); // D98 — sans la garde, la tranche serait vide
    const fin = apiMobile.indexOf('}', apiMobile.indexOf('else', debut));
    expect(fin).toBeGreaterThan(debut);
    const branche = apiMobile.slice(debut, fin);
    expect(branche).toContain("query.set('weightKg'");
    expect(branche).toContain("query.set('estimateKg'");
    expect(branche).toContain('else');
  });
});

describe('le point de la pastille de filtres ne ment pas non plus', () => {
  const ecran = readFileSync(join(MOBILE, 'src/app/(tabs)/index.tsx'), 'utf8');

  it('il ne compare plus le tri à une valeur qui n’est plus le défaut', () => {
    // Régression introduite par D100 et trouvée ici : l'indicateur lisait
    // `sort !== 'earliest'`, vrai EN PERMANENCE depuis que le défaut est
    // `relevance`. Il annonçait un filtre posé sur un écran vierge — et un
    // indicateur toujours allumé n'est pas un indicateur (D99 3A, D100 4A).
    expect(ecran).not.toMatch(/filtersActive\s*=\s*sort !== 'earliest'/);
    expect(ecran).toMatch(/filtersActive\s*=\s*sort !== 'relevance'/);
  });

  it('il compte le poids, qui est un filtre comme un autre', () => {
    const debut = ecran.indexOf('const filtersActive');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = ecran.indexOf(';', debut);
    expect(fin).toBeGreaterThan(debut);
    expect(ecran.slice(debut, fin)).toContain('weightKg !== null');
  });
});
