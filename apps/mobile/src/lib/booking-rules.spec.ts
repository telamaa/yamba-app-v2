/**
 * booking-rules.spec.ts — les règles du tunnel natif (A217 → A220).
 * ==================================================================
 * Sept étapes, sept décisions, et des validations qui ne rendent que des
 * CODES — c'est ce qui les rend testables sans i18n (D44 : jamais un
 * `fr ? … : …`). Le serveur revérifie tout (RG-MOB-1) : ces règles servent à
 * ne pas faire marcher l'Expéditeur jusqu'au paiement pour rien, et c'est
 * précisément ce qu'on vérifie ici — elles doivent refuser ce que le serveur
 * refuserait, et RIEN DE PLUS.
 *
 * Le devis passe par `@packages/pricing`, LE moteur partagé avec le snapshot
 * serveur (D34) : aucune formule n'est réécrite dans l'app, et ces fiches le
 * prouvent en comparant au moteur, pas à des nombres copiés à la main.
 */
import { PRICING_PARAMS, quoteShipperPrice } from '@packages/pricing';

import {
  MAX_PARCEL_KG,
  PARCEL_FAMILIES,
  SIZE_CLASSES,
  capacityNeededKg,
  familyStance,
  firstAcceptedFamily,
  offeredProducts,
  parseWeight,
  quoteDraft,
  validateContentStep,
  validateParcelStep,
  validateRecipientStep,
  validateValueStep,
} from '@/lib/booking-rules';
import { getBookingDraft, setBookingDraft, type BookingDraft } from '@/lib/booking-draft';

import { aTrip } from '@/test-support/fixtures';

/** Un brouillon complet et NORMAL : chaque fiche ne décrit que son écart. */
function aDraft(patch: Partial<BookingDraft> = {}): BookingDraft {
  return {
    tripId: '68bbbbbb68bbbbbb68bbbbbb',
    product: 'PARCEL',
    family: 'CLOTHES_TEXTILE',
    sizeClass: 'S',
    weightKg: '2',
    declaredValueEur: '120',
    description: 'Deux pulls',
    photos: [],
    protection: 'BASIC',
    pickupIndex: 0,
    deliveryIndex: 0,
    recipient: {
      firstName: 'Awa',
      lastName: 'Nkounkou',
      phonePrefix: '+242',
      phoneNational: '06 00 00 00 0',
      email: '',
    },
    charterAccepted: true,
    termsAccepted: true,
    ...patch,
  };
}

describe('familyStance — l’absence de condition n’est PAS un refus', () => {
  it('un trajet qui ne déclare rien accepte les huit familles', () => {
    const trip = aTrip({ familyConditions: null });
    for (const family of PARCEL_FAMILIES) {
      expect(familyStance(trip, family)).toEqual({ mode: 'ACCEPT', surchargePct: 0 });
    }
  });

  it('une famille absente de la liste déclarée reste acceptée', () => {
    const trip = aTrip({
      familyConditions: [{ familyKey: 'ELECTRONICS_DEVICES', mode: 'REFUSE' }],
    });
    expect(familyStance(trip, 'CLOTHES_TEXTILE').mode).toBe('ACCEPT');
    expect(familyStance(trip, 'ELECTRONICS_DEVICES').mode).toBe('REFUSE');
  });

  it('un supplément négatif ou absent est ramené à zéro — jamais une remise involontaire', () => {
    const trip = aTrip({
      familyConditions: [
        { familyKey: 'FOOD_DRY_SEALED', mode: 'SURCHARGE', surchargePct: -10 },
        { familyKey: 'PARTS_TOOLS', mode: 'SURCHARGE', surchargePct: null },
      ],
    });
    expect(familyStance(trip, 'FOOD_DRY_SEALED').surchargePct).toBe(0);
    expect(familyStance(trip, 'PARTS_TOOLS').surchargePct).toBe(0);
  });
});

describe('firstAcceptedFamily — jamais une porte fermée par défaut', () => {
  it('prend la première famille de l’ordre d’affichage quand tout est accepté', () => {
    expect(firstAcceptedFamily(aTrip())).toBe(PARCEL_FAMILIES[0]);
  });

  it('saute les familles refusées', () => {
    const trip = aTrip({
      familyConditions: [
        { familyKey: 'DOCUMENTS_PAPERS', mode: 'REFUSE' },
        { familyKey: 'CLOTHES_TEXTILE', mode: 'REFUSE' },
      ],
    });
    expect(firstAcceptedFamily(trip)).toBe('FOOD_DRY_SEALED');
  });

  it('un supplément n’est pas un refus : la famille reste proposable', () => {
    const trip = aTrip({
      familyConditions: [{ familyKey: 'DOCUMENTS_PAPERS', mode: 'SURCHARGE', surchargePct: 20 }],
    });
    expect(firstAcceptedFamily(trip)).toBe('DOCUMENTS_PAPERS');
  });

  it('un trajet qui refuse TOUT rend quand même une famille (l’écran dira le refus)', () => {
    const trip = aTrip({
      familyConditions: PARCEL_FAMILIES.map((familyKey) => ({ familyKey, mode: 'REFUSE' as const })),
    });
    expect(firstAcceptedFamily(trip)).toBe(PARCEL_FAMILIES[0]);
  });
});

describe('parseWeight — ce que les gens tapent vraiment', () => {
  it('accepte la virgule décimale française', () => {
    expect(parseWeight('2,5')).toBe(2.5);
    expect(parseWeight('2.5')).toBe(2.5);
  });

  it('refuse le vide, le zéro, le négatif et le non-nombre', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('0')).toBeNull();
    expect(parseWeight('-3')).toBeNull();
    expect(parseWeight('deux')).toBeNull();
    expect(parseWeight('Infinity')).toBeNull();
  });
});

describe('offeredProducts — un forfait absent n’est pas une option', () => {
  it('un trajet au kilo seul ne propose que le colis', () => {
    expect(offeredProducts(aTrip())).toEqual(['PARCEL']);
  });

  it('les forfaits n’apparaissent qu’avec un prix strictement positif', () => {
    const trip = aTrip({ checkedBag23PriceCents: 0, cabinBag12PriceCents: 4500 });
    expect(offeredProducts(trip)).toEqual(['PARCEL', 'CABIN_BAG_12KG']);
  });

  it('un trajet sans aucun prix ne propose RIEN — et le dit par une liste vide', () => {
    expect(offeredProducts(aTrip({ pricePerKgCents: null }))).toEqual([]);
  });
});

describe('capacityNeededKg — un bagage entier a un poids forfaitaire', () => {
  it('les deux forfaits consomment leur franchise, pas le poids saisi', () => {
    expect(capacityNeededKg(aDraft({ product: 'CHECKED_BAG_23KG', weightKg: '1' }))).toBe(23);
    expect(capacityNeededKg(aDraft({ product: 'CABIN_BAG_12KG', weightKg: '1' }))).toBe(12);
  });

  it('un colis consomme le poids saisi', () => {
    expect(capacityNeededKg(aDraft({ weightKg: '7,5' }))).toBe(7.5);
  });
});

describe('validateParcelStep — refuser ici ce que le serveur refuserait', () => {
  it('un colis normal ne bloque sur rien', () => {
    expect(validateParcelStep(aDraft(), aTrip())).toEqual({});
  });

  it('une famille refusée par le Voyageur bloque l’étape', () => {
    const trip = aTrip({ familyConditions: [{ familyKey: 'CLOTHES_TEXTILE', mode: 'REFUSE' }] });
    expect(validateParcelStep(aDraft(), trip).family).toBe('FAMILY_REFUSED');
  });

  it('un poids absent est demandé avant tout le reste', () => {
    expect(validateParcelStep(aDraft({ weightKg: '' }), aTrip()).weightKg).toBe('WEIGHT_REQUIRED');
  });

  it('CAP-01 — 30 kg passent, 30,1 non', () => {
    expect(validateParcelStep(aDraft({ weightKg: String(MAX_PARCEL_KG) }), aTrip({ remainingKg: 40 })))
      .toEqual({});
    expect(
      validateParcelStep(aDraft({ weightKg: '30.1' }), aTrip({ remainingKg: 40 })).weightKg
    ).toBe('WEIGHT_MAX');
  });

  it('le plafond par colis PRIME la capacité restante : le message doit parler du colis', () => {
    const trip = aTrip({ remainingKg: 2 });
    expect(validateParcelStep(aDraft({ weightKg: '35' }), trip).weightKg).toBe('WEIGHT_MAX');
  });

  it('un poids qui dépasse la capacité restante bloque, bornes comprises', () => {
    const trip = aTrip({ remainingKg: 5 });
    expect(validateParcelStep(aDraft({ weightKg: '5' }), trip)).toEqual({});
    expect(validateParcelStep(aDraft({ weightKg: '5.1' }), trip).weightKg).toBe('WEIGHT_REMAINING');
  });

  it('une capacité NON SERVIE ne bloque rien — l’absence n’est pas un zéro', () => {
    const trip = aTrip({ remainingKg: null });
    expect(validateParcelStep(aDraft({ weightKg: '28' }), trip)).toEqual({});
  });

  it('un forfait que le trajet ne propose pas bloque sur le produit', () => {
    const draft = aDraft({ product: 'CHECKED_BAG_23KG' });
    expect(validateParcelStep(draft, aTrip()).product).toBe('BAG_NOT_OFFERED');
  });

  it('un forfait proposé mais trop lourd pour la place restante bloque aussi', () => {
    const trip = aTrip({ checkedBag23PriceCents: 9000, remainingKg: 10 });
    const draft = aDraft({ product: 'CHECKED_BAG_23KG' });
    expect(validateParcelStep(draft, trip).product).toBe('NOT_ENOUGH_CAPACITY');
  });

  it('la famille n’est PAS vérifiée pour un bagage entier (il n’y a rien à déclarer)', () => {
    const trip = aTrip({
      checkedBag23PriceCents: 9000,
      remainingKg: 30,
      familyConditions: [{ familyKey: 'CLOTHES_TEXTILE', mode: 'REFUSE' }],
    });
    expect(validateParcelStep(aDraft({ product: 'CHECKED_BAG_23KG' }), trip)).toEqual({});
  });
});

describe('quoteDraft — le moteur partagé, jamais une formule réécrite', () => {
  it('rend exactement ce que le moteur rend pour les mêmes entrées', () => {
    const trip = aTrip({ pricePerKgCents: 1000 });
    const result = quoteDraft(aDraft({ weightKg: '2', sizeClass: 'S' }), trip);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const direct = quoteShipperPrice(
      {
        product: 'PARCEL',
        pricePerKgCents: 1000,
        checkedBag23PriceCents: null,
        cabinBag12PriceCents: null,
        weightKg: 2,
        sizeClass: 'S',
        familySurchargePct: 0,
        protection: 'BASIC',
      },
      PRICING_PARAMS
    );
    expect(result.quote).toEqual(direct);
  });

  it('D81 — le plancher en kilos s’applique, et le devis DIT lequel des trois a gagné', () => {
    const result = quoteDraft(aDraft({ weightKg: '1' }), aTrip({ pricePerKgCents: 1000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.billableWeightKg).toBe(PRICING_PARAMS.billingFloorKg);
    expect(result.quote.billableReason).toBe('FLOOR');
  });

  it('le minimum de TAILLE l’emporte quand il dépasse le plancher (un L d’un kilo)', () => {
    const result = quoteDraft(aDraft({ weightKg: '1', sizeClass: 'L' }), aTrip());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.billableWeightKg).toBe(PRICING_PARAMS.sizeMinKg.L);
    expect(result.quote.billableReason).toBe('SIZE_MIN');
    expect(result.quote.capacityKgConsumed).toBe(PRICING_PARAMS.sizeMinKg.L);
  });

  it('un supplément de famille renchérit le transport, et ne touche pas la prime', () => {
    const trip = aTrip({
      familyConditions: [{ familyKey: 'CLOTHES_TEXTILE', mode: 'SURCHARGE', surchargePct: 50 }],
    });
    const plain = quoteDraft(aDraft({ weightKg: '10' }), aTrip());
    const surcharged = quoteDraft(aDraft({ weightKg: '10' }), trip);
    expect(plain.ok && surcharged.ok).toBe(true);
    if (!plain.ok || !surcharged.ok) return;
    expect(surcharged.quote.transportCents).toBe(Math.round(plain.quote.transportCents * 1.5));
    expect(surcharged.quote.familySurchargePct).toBe(50);
  });

  it('un REFUS de famille ne facture AUCUN supplément (l’étape bloque ailleurs)', () => {
    const trip = aTrip({
      familyConditions: [{ familyKey: 'CLOTHES_TEXTILE', mode: 'REFUSE', surchargePct: 50 }],
    });
    const result = quoteDraft(aDraft({ weightKg: '10' }), trip);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.familySurchargePct).toBe(0);
  });

  it('un devis impossible est un ÉTAT, pas une exception : il rend son code', () => {
    expect(quoteDraft(aDraft(), aTrip({ pricePerKgCents: null }))).toEqual({
      ok: false,
      code: 'MISSING_PRICE_PER_KG',
    });
    expect(quoteDraft(aDraft({ weightKg: '' }), aTrip())).toEqual({
      ok: false,
      code: 'MISSING_WEIGHT',
    });
    expect(quoteDraft(aDraft({ product: 'CABIN_BAG_12KG' }), aTrip())).toEqual({
      ok: false,
      code: 'BAG_NOT_OFFERED',
    });
  });

  it('les trois tailles donnent un devis, et aucune ne coûte moins que S', () => {
    const totals = SIZE_CLASSES.map((sizeClass) => {
      const result = quoteDraft(aDraft({ weightKg: '1', sizeClass }), aTrip());
      expect(result.ok).toBe(true);
      return result.ok ? result.quote.totalShipperCents : 0;
    });
    expect(totals[1]).toBeGreaterThanOrEqual(totals[0]);
    expect(totals[2]).toBeGreaterThanOrEqual(totals[1]);
  });
});

describe('validateRecipientStep — le téléphone est la donnée critique (D43)', () => {
  it('un destinataire complet ne bloque sur rien', () => {
    expect(validateRecipientStep(aDraft())).toEqual({});
  });

  it('un numéro absent est demandé AVANT d’être jugé invalide', () => {
    expect(validateRecipientStep(aDraft({
      recipient: { ...aDraft().recipient, phoneNational: '   ' },
    })).phone).toBe('PHONE_REQUIRED');
  });

  it('un numéro trop court est invalide — il ne doit pas voyager jusqu’à la gare', () => {
    expect(validateRecipientStep(aDraft({
      recipient: { ...aDraft().recipient, phoneNational: '12' },
    })).phone).toBe('PHONE_INVALID');
  });

  it('le nom et le prénom sont requis, les espaces ne comptent pas', () => {
    const errors = validateRecipientStep(aDraft({
      recipient: { ...aDraft().recipient, firstName: ' ', lastName: '' },
    }));
    expect(errors.firstName).toBe('FIRST_NAME_REQUIRED');
    expect(errors.lastName).toBe('LAST_NAME_REQUIRED');
  });

  it('l’email reste FACULTATIF — vide ne bloque pas', () => {
    expect(validateRecipientStep(aDraft()).email).toBeUndefined();
  });

  it('…mais s’il est saisi, il doit être plausible : un email fautif ne prévient personne', () => {
    expect(validateRecipientStep(aDraft({
      recipient: { ...aDraft().recipient, email: 'awa@' },
    })).email).toBe('EMAIL_INVALID');
    expect(validateRecipientStep(aDraft({
      recipient: { ...aDraft().recipient, email: 'awa@exemple.cg' },
    })).email).toBeUndefined();
  });
});

describe('validateValueStep — sans valeur déclarée, la garantie n’a rien à couvrir (A217)', () => {
  it('un prix d’achat positif suffit, virgule comprise', () => {
    expect(validateValueStep(aDraft({ declaredValueEur: '120' }))).toEqual({});
    expect(validateValueStep(aDraft({ declaredValueEur: '99,90' }))).toEqual({});
  });

  it('le vide, le zéro et le texte sont refusés', () => {
    for (const value of ['', '0', 'cher']) {
      expect(validateValueStep(aDraft({ declaredValueEur: value })).declaredValueEur).toBe(
        'VALUE_REQUIRED'
      );
    }
  });
});

describe('validateContentStep — la photo n’est exigée que SOUS garantie', () => {
  it('une description de cinq caractères suffit en protection de base', () => {
    expect(validateContentStep(aDraft({ description: 'Pulls' }))).toEqual({});
  });

  it('quatre caractères, ou quatre caractères noyés dans des espaces, ne suffisent pas', () => {
    expect(validateContentStep(aDraft({ description: 'Pull' })).description).toBe(
      'DESCRIPTION_TOO_SHORT'
    );
    expect(validateContentStep(aDraft({ description: '  Pull  ' })).description).toBe(
      'DESCRIPTION_TOO_SHORT'
    );
  });

  it('la Garantie SANS photo bloque — c’est la raison pour laquelle la protection se choisit avant', () => {
    expect(validateContentStep(aDraft({ protection: 'EXTENDED_500' })).photos).toBe(
      'PHOTOS_REQUIRED_WITH_GUARANTEE'
    );
  });

  it('la Garantie AVEC une photo passe', () => {
    const draft = aDraft({
      protection: 'EXTENDED_500',
      photos: [
        {
          id: 'file:///tmp/colis.jpg',
          uri: 'file:///tmp/colis.jpg',
          context: 'DECLARED_CONTENT',
          mimeType: 'image/jpeg',
          fileName: 'colis.jpg',
          sizeBytes: 120_000,
        },
      ],
    });
    expect(validateContentStep(draft)).toEqual({});
  });

  it('la protection de base n’exige aucune photo', () => {
    expect(validateContentStep(aDraft({ protection: 'BASIC', photos: [] })).photos).toBeUndefined();
  });
});

describe('le brouillon partagé reste l’affaire du store, pas des règles', () => {
  it('les règles ne lisent JAMAIS le brouillon du module : elles reçoivent le leur', () => {
    setBookingDraft({ weightKg: '99' });
    expect(getBookingDraft().weightKg).toBe('99');
    // Le brouillon de module est à 99 kg, hors plafond — la validation d'un
    // brouillon PASSÉ en argument n'en sait rien et reste verte.
    expect(validateParcelStep(aDraft({ weightKg: '2' }), aTrip())).toEqual({});
  });
});
