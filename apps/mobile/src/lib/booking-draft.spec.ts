/**
 * booking-draft.spec.ts — le brouillon de réservation, en mémoire de processus.
 * =============================================================================
 * Le tunnel est une PILE de sept pages poussées, et une page poussée ne
 * retourne rien à celle qui l'a poussée (`router.back()` ne transporte pas de
 * valeur). D'où ce brouillon de module, avec deux propriétés VOULUES :
 *   • il meurt avec le processus — une réservation non payée n'engage rien ;
 *   • il est lié à UN trajet : ouvrir la réservation d'un autre trajet repart
 *     d'un brouillon neuf, jamais des miettes du précédent.
 *
 * Et une contrainte technique qui en est une vraie : `useSyncExternalStore`
 * exige une référence STABLE tant que rien ne change — rendre un objet neuf à
 * chaque lecture boucle à l'infini. C'est la fiche la plus importante du
 * fichier, et elle n'a pas besoin de React pour le vérifier.
 */
import {
  clearBookingDraft,
  getBookingDraft,
  setBookingDraft,
  startBookingDraft,
  subscribeBookingDraft,
} from '@/lib/booking-draft';
import { PARCEL_FAMILIES } from '@/lib/booking-rules';

import { aTrip } from '@/test-support/fixtures';

beforeEach(() => {
  clearBookingDraft();
});

describe('la référence rendue', () => {
  it('est STABLE tant que rien ne change — sinon useSyncExternalStore boucle', () => {
    expect(getBookingDraft()).toBe(getBookingDraft());
  });

  it('change dès qu’une écriture a lieu — sinon l’écran ne se redessine pas', () => {
    const before = getBookingDraft();
    setBookingDraft({ weightKg: '5' });
    expect(getBookingDraft()).not.toBe(before);
    expect(getBookingDraft().weightKg).toBe('5');
  });
});

describe('les abonnés', () => {
  it('sont prévenus à chaque écriture', () => {
    const listener = jest.fn();
    subscribeBookingDraft(listener);
    setBookingDraft({ weightKg: '3' });
    clearBookingDraft();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('se désabonnent vraiment — un écran démonté ne doit plus être réveillé', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBookingDraft(listener);
    unsubscribe();
    setBookingDraft({ weightKg: '4' });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('le brouillon neuf part des contraintes du TRAJET', () => {
  it('choisit la première famille que le Voyageur n’a pas refusée', () => {
    const trip = aTrip({
      familyConditions: [
        { familyKey: 'DOCUMENTS_PAPERS', mode: 'REFUSE' },
        { familyKey: 'CLOTHES_TEXTILE', mode: 'REFUSE' },
      ],
    });
    startBookingDraft(trip);
    expect(getBookingDraft().family).toBe('FOOD_DRY_SEALED');
  });

  it('choisit d’office un lieu quand il n’y en a qu’un — rien à décider', () => {
    startBookingDraft(aTrip());
    expect(getBookingDraft().pickupIndex).toBe(0);
    expect(getBookingDraft().deliveryIndex).toBe(0);
  });

  it('ne choisit RIEN quand plusieurs lieux sont proposés', () => {
    const trip = aTrip({
      pickupLocations: [
        { kind: 'AIRPORT', details: 'T2E', flexibility: 'EXACT', radiusKm: null },
        { kind: 'CITY_AREA', details: 'Gare du Nord', flexibility: 'CITY_WIDE', radiusKm: null },
      ],
    });
    startBookingDraft(trip);
    expect(getBookingDraft().pickupIndex).toBeNull();
  });

  it('prend le produit RÉELLEMENT proposé — un trajet sans prix au kilo ne propose pas « colis »', () => {
    const trip = aTrip({ pricePerKgCents: null, checkedBag23PriceCents: 9000 });
    startBookingDraft(trip, 'CHECKED_BAG_23KG');
    expect(getBookingDraft().product).toBe('CHECKED_BAG_23KG');
  });

  it('D33 — part du colis de RÉFÉRENCE (2 kg) : la barre de prix annonce un vrai total', () => {
    startBookingDraft(aTrip());
    expect(getBookingDraft().weightKg).toBe('2');
  });
});

describe('rouvrir, ou changer de trajet', () => {
  it('le MÊME trajet reprend où on en était — l’Expéditeur est juste revenu en arrière', () => {
    const trip = aTrip();
    startBookingDraft(trip);
    setBookingDraft({ weightKg: '7', description: 'Trois pulls' });
    startBookingDraft(trip);
    expect(getBookingDraft().weightKg).toBe('7');
    expect(getBookingDraft().description).toBe('Trois pulls');
  });

  it('un AUTRE trajet repart de zéro — jamais les miettes du précédent', () => {
    startBookingDraft(aTrip());
    setBookingDraft({ weightKg: '7', description: 'Trois pulls', termsAccepted: true });
    startBookingDraft(aTrip({ id: '68cccccc68cccccc68cccccc' }));
    const draft = getBookingDraft();
    expect(draft.tripId).toBe('68cccccc68cccccc68cccccc');
    expect(draft.weightKg).toBe('2');
    expect(draft.description).toBe('');
    expect(draft.termsAccepted).toBe(false);
  });

  it('rouvrir le même trajet ne prévient PAS les abonnés (rien n’a changé)', () => {
    const trip = aTrip();
    startBookingDraft(trip);
    const listener = jest.fn();
    subscribeBookingDraft(listener);
    startBookingDraft(trip);
    expect(listener).not.toHaveBeenCalled();
  });

  it('un brouillon vidé n’a plus de trajet, et les huit familles restent déclarées', () => {
    startBookingDraft(aTrip());
    clearBookingDraft();
    expect(getBookingDraft().tripId).toBeNull();
    expect(PARCEL_FAMILIES).toHaveLength(8);
  });
});
