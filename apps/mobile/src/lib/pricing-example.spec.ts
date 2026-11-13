/**
 * pricing-example.spec.ts — l'ancre « ex. colis 2 kg ≈ 27 € » (D15).
 * ==================================================================
 * Cette projection recopie TROIS paramètres du moteur partagé (le plancher en
 * kilos de D81, la commission de D16 et son plancher) pour ne pas tirer
 * `@packages/pricing` dans un écran d'atterrissage. Le risque est donc le
 * même que pour les constantes du contrat : une divergence silencieuse qui
 * annoncerait un prix que le tunnel ne tiendra pas.
 *
 * La fiche la supprime : elle compare la copie au moteur, et vérifie la seule
 * promesse que l'ancre fait — ne JAMAIS annoncer moins cher que le devis réel.
 */
import { PRICING_PARAMS, quoteShipperPrice } from '@packages/pricing';

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BILLING_FLOOR_KG,
  PRICING_EXAMPLE_PARAMS,
  estimateShipperTotalCents,
  formatAmountFromCents,
} from '@/lib/pricing-example';

describe('les trois paramètres RECOPIÉS sont ceux du moteur', () => {
  it('le plancher de facturation, en kilos (D81)', () => {
    expect(PRICING_EXAMPLE_PARAMS.billingFloorKg).toBe(PRICING_PARAMS.billingFloorKg);
    expect(BILLING_FLOOR_KG).toBe(PRICING_PARAMS.billingFloorKg);
  });

  it('la commission Expéditeur et son plancher (D16)', () => {
    expect(PRICING_EXAMPLE_PARAMS.commissionPct).toBe(PRICING_PARAMS.commissionPct);
    expect(PRICING_EXAMPLE_PARAMS.commissionFloorCents).toBe(PRICING_PARAMS.commissionFloorCents);
  });

  it('le colis d’exemple est le colis de RÉFÉRENCE de la recherche (2 kg)', () => {
    expect(PRICING_EXAMPLE_PARAMS.exampleWeightKg).toBe(2);
  });
});

describe('estimateShipperTotalCents — tout en cents entiers', () => {
  it('applique le plancher en kilos avant de multiplier', () => {
    const { transportCents } = estimateShipperTotalCents(1000, 1);
    expect(transportCents).toBe(Math.round(1000 * PRICING_PARAMS.billingFloorKg));
  });

  it('un colis plus lourd que le plancher est facturé à son poids', () => {
    expect(estimateShipperTotalCents(1000, 10).transportCents).toBe(10_000);
  });

  it('le plancher de commission s’applique sur les petits transports', () => {
    const { serviceCents } = estimateShipperTotalCents(100, 2);
    expect(serviceCents).toBe(PRICING_PARAMS.commissionFloorCents);
  });

  it('au-delà, la commission est un pourcentage', () => {
    const { transportCents, serviceCents } = estimateShipperTotalCents(2000, 10);
    expect(serviceCents).toBe(Math.round((transportCents * PRICING_PARAMS.commissionPct) / 100));
  });

  it('le total est la somme, et rien d’autre — jamais un centime flottant', () => {
    const quote = estimateShipperTotalCents(1234, 3.7);
    expect(quote.totalCents).toBe(quote.transportCents + quote.serviceCents);
    expect(Number.isInteger(quote.totalCents)).toBe(true);
    expect(Number.isInteger(quote.transportCents)).toBe(true);
    expect(Number.isInteger(quote.serviceCents)).toBe(true);
  });
});

describe('l’ancre ne promet JAMAIS moins cher que le devis du tunnel', () => {
  // La projection ne connaît que le poids : elle rend donc le prix d'un colis
  // S, le plus bas possible. Elle peut être DÉPASSÉE en M ou L, jamais tenue
  // en dessous — sinon l'Expéditeur découvre une hausse au moment de payer.
  const weights = [0.5, 1, 2, 2.3, 5, 12.4, 30];
  const prices = [500, 1000, 1850, 3000];

  it.each(prices)('à %i cents le kilo, la projection égale le devis S', (pricePerKgCents) => {
    for (const weightKg of weights) {
      const anchor = estimateShipperTotalCents(pricePerKgCents, weightKg);
      const real = quoteShipperPrice({
        product: 'PARCEL',
        pricePerKgCents,
        checkedBag23PriceCents: null,
        cabinBag12PriceCents: null,
        weightKg,
        sizeClass: 'S',
        familySurchargePct: 0,
        protection: 'BASIC',
      });
      expect(anchor.totalCents).toBe(real.totalShipperCents);
    }
  });

  it('et reste INFÉRIEURE OU ÉGALE au devis en M et en L', () => {
    for (const sizeClass of ['M', 'L'] as const) {
      const real = quoteShipperPrice({
        product: 'PARCEL',
        pricePerKgCents: 1000,
        checkedBag23PriceCents: null,
        cabinBag12PriceCents: null,
        weightKg: 1,
        sizeClass,
        familySurchargePct: 0,
        protection: 'BASIC',
      });
      expect(estimateShipperTotalCents(1000, 1).totalCents).toBeLessThanOrEqual(
        real.totalShipperCents
      );
    }
  });
});

/**
 * D99 1A — LA COPIE EST UNE COPIE, ET LA FICHE L'EXIGE.
 *
 * `pricing-example.ts` existe en DEUX exemplaires — un par front — et c'est
 * volontaire : le mobile ne doit pas tirer `@packages/pricing` dans un écran
 * d'atterrissage (voir l'en-tête de ce fichier). Mais deux fichiers qu'on
 * promet identiques et que personne ne compare finissent par ne plus l'être :
 * c'est le motif de `maskEmail` (D92), de la lecture des refus (D96) et de la
 * liste des pages d'auth (D93).
 *
 * Cette fiche-ci rend la promesse vérifiable, à l'octet près. Elle a une
 * conséquence utile : comme les fiches ci-dessus confrontent déjà la copie du
 * MOBILE au moteur partagé, la copie du SITE se trouve couverte par
 * transitivité — alors que `apps/user-ui` n'a toujours aucun harnais de
 * tests. Une fiche, deux fronts.
 */
describe('les deux copies de la projection sont la MÊME (D99 1A)', () => {
  const MOBILE = resolve(__dirname, '../..');
  const WEB = resolve(MOBILE, '../user-ui');

  it('octet pour octet', () => {
    const ici = readFileSync(join(MOBILE, 'src/lib/pricing-example.ts'), 'utf8');
    const la = readFileSync(join(WEB, 'src/lib/pricing-example.ts'), 'utf8');
    expect(la).toBe(ici);
  });
});

describe('formatAmountFromCents — deux décimales, toujours (D99 1A)', () => {
  it('ne laisse jamais tomber les centimes', () => {
    // Le défaut corrigé : le site affichait « 25 » là où le téléphone
    // affichait « 24,85 » pour le même trajet et le même colis.
    expect(formatAmountFromCents(2485, 'fr-FR')).toBe('24,85');
    expect(formatAmountFromCents(2485, 'en-GB')).toBe('24.85');
  });

  it('complète un montant rond, plutôt que de le raccourcir', () => {
    expect(formatAmountFromCents(2500, 'fr-FR')).toBe('25,00');
    expect(formatAmountFromCents(900, 'en-GB')).toBe('9.00');
  });

  it('le séparateur suit la LANGUE, pas le pays du prix', () => {
    expect(formatAmountFromCents(123456, 'fr-FR')).toContain(',');
    expect(formatAmountFromCents(123456, 'en-GB')).toContain('.');
  });

  it('deux montants proches ne se confondent plus', () => {
    // L'arrondi à l'euro affichait « 25 € » pour les deux.
    expect(formatAmountFromCents(2485, 'fr-FR')).not.toBe(formatAmountFromCents(2540, 'fr-FR'));
  });
});
