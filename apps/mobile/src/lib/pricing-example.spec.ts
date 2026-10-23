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

import {
  BILLING_FLOOR_KG,
  PRICING_EXAMPLE_PARAMS,
  estimateShipperTotalCents,
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
