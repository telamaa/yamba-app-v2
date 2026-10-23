/**
 * location-format.spec.ts — la forme d'un lieu de rendez-vous.
 * ============================================================
 * Ce module ne traduit rien : il rend une CLÉ i18n et ses valeurs. La seule
 * règle à tenir est celle du « Rayon null km » : un lieu déclaré souple sans
 * rayon ne dit rien d'utile, donc il ne dit rien.
 */
import {
  DEFAULT_LOCATION_ICON,
  LOCATION_ICONS,
  flexibilityLabelKey,
} from '@/lib/location-format';

describe('les icônes des trois sortes de lieux', () => {
  it('couvrent les trois `kind` du contrat', () => {
    expect(Object.keys(LOCATION_ICONS).sort()).toEqual(['AIRPORT', 'CITY_AREA', 'TRAIN_STATION']);
  });

  it('ont un repli pour une sorte inconnue — un lieu neuf côté serveur ne casse pas l’écran', () => {
    expect(LOCATION_ICONS['SOMETHING_NEW'] ?? DEFAULT_LOCATION_ICON).toBe('location-outline');
  });
});

describe('flexibilityLabelKey', () => {
  it('rend la clé nichée, jamais une phrase', () => {
    expect(flexibilityLabelKey('EXACT', null)).toEqual({ key: 'locations.flex.EXACT' });
    expect(flexibilityLabelKey('CITY_WIDE', null)).toEqual({ key: 'locations.flex.CITY_WIDE' });
  });

  it('porte le rayon en VALEUR ICU quand il existe', () => {
    expect(flexibilityLabelKey('RADIUS', 15)).toEqual({
      key: 'locations.flex.RADIUS',
      values: { km: 15 },
    });
  });

  it('un rayon absent ou nul ne produit pas « Rayon null km » : il ne produit rien', () => {
    expect(flexibilityLabelKey('RADIUS', null)).toBeNull();
    expect(flexibilityLabelKey('RADIUS', 0)).toBeNull();
  });
});
