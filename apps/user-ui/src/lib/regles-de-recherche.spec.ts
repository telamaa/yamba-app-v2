/**
 * regles-de-recherche.spec.ts — les règles de la page de résultats (A224).
 * =========================================================================
 * Ces quatre modules portent les corrections des 14 et 15/11 (D99 à D102).
 * Jusqu'ici, aucune n'était gardée DIRECTEMENT côté site : elles ne tenaient
 * que par ricochet, depuis des fiches du harnais mobile qui comparent les
 * copies À L'OCTET PRÈS.
 *
 * Ce dispositif garde l'ÉGALITÉ de deux fichiers ; il ne garde pas le
 * COMPORTEMENT d'une règle. Une règle fausse des deux côtés resterait verte.
 * C'est la différence que ce fichier comble.
 */
import { EMPTY_FACET_OPACITY, isEmptyFacet } from '@/lib/search-facets';
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
import {
  BILLING_FLOOR_KG,
  PRICE_FRACTION_DIGITS,
  PRICING_EXAMPLE_PARAMS,
  billedKg,
  estimateShipperTotalCents,
  formatAmountFromCents,
} from '@/lib/pricing-example';
import { MIN_SHOWN_VIEWS, POPULAR_VIEWS, isPopular, showsViews } from '@/lib/trip-signals';

describe('D100 5A — un compteur à zéro se lit pareil partout', () => {
  it('une facette sans résultat s’efface', () => {
    expect(isEmptyFacet(0, false)).toBe(true);
  });

  it('une facette ACTIVE ne s’efface jamais, même à zéro', () => {
    // Elle est le chemin de SORTIE du filtre qu'on vient de poser.
    expect(isEmptyFacet(0, true)).toBe(false);
  });

  it('ne rien savoir n’est pas savoir qu’il n’y a rien', () => {
    expect(isEmptyFacet(null, false)).toBe(false);
    expect(isEmptyFacet(undefined, false)).toBe(false);
  });

  it('l’opacité reste assez présente pour rester une porte', () => {
    expect(EMPTY_FACET_OPACITY).toBeGreaterThan(0.3);
    expect(EMPTY_FACET_OPACITY).toBeLessThan(1);
  });
});

describe('D100 4A — un compteur de vues sous son seuil dessert le trajet', () => {
  it('« 1 vue » ne s’affiche pas : c’était publier l’impopularité d’une offre', () => {
    expect(showsViews(1)).toBe(false);
    expect(showsViews(MIN_SHOWN_VIEWS - 1)).toBe(false);
    expect(showsViews(MIN_SHOWN_VIEWS)).toBe(true);
  });

  it('un compteur absent n’est pas un compteur à zéro', () => {
    expect(showsViews(null)).toBe(false);
    expect(showsViews(undefined)).toBe(false);
  });

  it('le badge « Populaire » prend le relais plus haut que le simple affichage', () => {
    // Deux seuils, dans cet ordre : d'abord on montre, ensuite on félicite.
    expect(POPULAR_VIEWS).toBeGreaterThanOrEqual(MIN_SHOWN_VIEWS);
    expect(isPopular(POPULAR_VIEWS - 1)).toBe(false);
    expect(isPopular(POPULAR_VIEWS)).toBe(true);
  });
});

describe('D100 2A — la mention nomme le poids que le prix FACTURE', () => {
  it('sous le plancher, le poids facturé est le plancher', () => {
    // Le défaut mesuré : site à 1,5 kg et téléphone à 2 kg affichaient le même
    // 24,85 €, et le curseur semblait donc inerte.
    expect(billedKg(0.2)).toBe(BILLING_FLOOR_KG);
    expect(billedKg(1.5)).toBe(BILLING_FLOOR_KG);
    expect(billedKg(2)).toBe(BILLING_FLOOR_KG);
  });

  it('au-dessus, le poids du colis est celui qu’on paie', () => {
    expect(billedKg(BILLING_FLOOR_KG)).toBe(BILLING_FLOOR_KG);
    expect(billedKg(5)).toBe(5);
  });

  it('le colis SUPPOSÉ est sous le plancher — et c’est tout le sujet', () => {
    // 2 kg par défaut, facturés 2,3 : c'est cette différence qui faisait
    // paraître le curseur inerte, et que la mention doit refléter.
    expect(PRICING_EXAMPLE_PARAMS.exampleWeightKg).toBeLessThan(BILLING_FLOOR_KG);
  });
});

describe('D99 1A — un prix s’écrit avec deux décimales, selon la LANGUE', () => {
  it('ne laisse jamais tomber les centimes', () => {
    // Le défaut corrigé : le site affichait « 25 » là où le téléphone
    // affichait « 24,85 » pour le même trajet et le même colis.
    expect(formatAmountFromCents(2485, 'fr-FR')).toBe('24,85');
    expect(formatAmountFromCents(2485, 'en-GB')).toBe('24.85');
  });

  it('complète un montant rond plutôt que de le raccourcir', () => {
    expect(formatAmountFromCents(2500, 'fr-FR')).toBe('25,00');
    expect(PRICE_FRACTION_DIGITS).toBe(2);
  });

  it('la projection n’annonce JAMAIS moins cher que ce qui sera facturé', () => {
    // La seule promesse que cette estimation fait à l'Expéditeur : un total
    // qui augmente entre la liste et le paiement coûte plus cher en confiance
    // que deux décimales en lisibilité.
    for (const kg of [0.2, 1, 2, 2.3, 5, 10]) {
      const { totalCents } = estimateShipperTotalCents(950, kg);
      const { totalCents: auPlancher } = estimateShipperTotalCents(950, billedKg(kg));
      expect(totalCents).toBe(auPlancher);
    }
  });
});

describe('D101 — le colis se règle dans le même domaine sur les deux fronts', () => {
  it('le colis supposé est atteignable au pas-à-pas', () => {
    expect(MIN_PARCEL_KG).toBeLessThanOrEqual(PRICING_EXAMPLE_PARAMS.exampleWeightKg);
    expect(MAX_PARCEL_KG).toBeGreaterThan(PRICING_EXAMPLE_PARAMS.exampleWeightKg);
  });

  it('on ne sort jamais du domaine', () => {
    expect(clampParcelKg(0)).toBe(MIN_PARCEL_KG);
    expect(clampParcelKg(999)).toBe(MAX_PARCEL_KG);
    expect(stepParcelKg(MIN_PARCEL_KG, -1)).toBe(MIN_PARCEL_KG);
    expect(stepParcelKg(MAX_PARCEL_KG, 1)).toBe(MAX_PARCEL_KG);
  });

  it('aucune valeur du domaine n’échappe un flottant', () => {
    // `Math.round(x / 0.5) * 0.5` rouvre des 2.4000000000000004, qui
    // s'afficheraient tels quels sous le curseur.
    for (let kg = MIN_PARCEL_KG; kg <= MAX_PARCEL_KG; kg += PARCEL_STEP_KG) {
      expect(Number.isInteger(clampParcelKg(kg) * 10)).toBe(true);
    }
  });

  it('chaque valeur d’usage est sur un cran du domaine', () => {
    for (const preset of PARCEL_PRESETS_KG) {
      expect(clampParcelKg(preset)).toBe(preset);
    }
  });

  it('canStep dit quand le bouton doit s’éteindre', () => {
    expect(canStepParcelKg(MIN_PARCEL_KG, -1)).toBe(false);
    expect(canStepParcelKg(MAX_PARCEL_KG, 1)).toBe(false);
    expect(canStepParcelKg(2, 1)).toBe(true);
  });

  it('un poids s’écrit selon la langue, jamais selon un pays en dur', () => {
    // D101 5A : le site écrivait « 1,5 kg » jusque dans son interface anglaise.
    expect(formatParcelKg(1.5, 'fr-FR')).toBe('1,5');
    expect(formatParcelKg(1.5, 'en-US')).toBe('1.5');
    expect(formatParcelKg(2, 'fr-FR')).toBe('2');
  });
});
