/**
 * trip-format.spec.ts — la mise en forme de la fiche trajet (A205).
 * =================================================================
 * MIROIR de `public-trip.helpers.ts` et `trip-signals.ts` côté site. Deux
 * choix de ce module sont des RÈGLES, pas des goûts, et ce sont eux qu'on
 * tient ici :
 *   • les mois et les jours viennent de TABLES, jamais de
 *     `toLocaleDateString` — dont les données dépendent du moteur (Hermes) et
 *     de l'OS, ce qui ferait diverger l'app du site sur le même trajet ;
 *   • les seuils de badge (« Populaire », compteur de vues) sont de la
 *     PRÉSENTATION : une pastille « 5 vues » dit « personne ne regarde ça ».
 *
 * Les prix passent, eux, par `Intl.NumberFormat` : les fiches comparent donc
 * à ce que le moteur produit (l'espace avant l'euro est insécable et change
 * selon la version d'ICU — l'écrire en dur serait un faux test).
 */
import {
  MIN_SHOWN_VIEWS,
  POPULAR_VIEWS,
  calculateCO2SavedKg,
  calculateDistanceKm,
  cityLabel,
  formatDayMonth,
  formatLocalTime,
  formatLongDate,
  formatMemberSince,
  formatMinutesDuration,
  formatMonthYear,
  formatPrice,
  formatPriceShort,
  formatTripDuration,
  getInitials,
  isPopular,
  showsViews,
  weekdayLabels,
} from '@/lib/trip-format';

/**
 * Samedi 20 mars 2027, midi LOCAL, converti en ISO.
 *
 * Ces mises en forme lisent la date de l'APPAREIL (`getDate`, `getMonth`,
 * `getDay`) : c'est l'intention — « samedi 20 mars » est le samedi de celui
 * qui regarde l'écran. Un instant écrit en UTC en dur ne décrit donc pas la
 * même date civile partout : mesuré, `2027-03-20T12:00:00Z` tombe le 21 mars
 * à Auckland (UTC+13). On part donc d'une date LOCALE, qui se relit à
 * l'identique sous n'importe quel fuseau — plutôt que d'épingler `TZ` dans le
 * harnais, ce qui aurait caché la propriété au lieu de la respecter.
 */
const LOCAL_NOON = new Date(2027, 2, 20, 12, 0, 0).toISOString();

describe('les prix — cents entiers jusqu’à la dernière seconde', () => {
  it('rendent la devise comme le moteur la rend', () => {
    expect(formatPrice(2600, 'EUR', 'fr')).toBe(
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(26)
    );
  });

  it('la forme courte laisse tomber les centimes d’un montant rond', () => {
    expect(formatPriceShort(2600, 'EUR', 'fr')).not.toMatch(/,00/);
    expect(formatPriceShort(2650, 'EUR', 'fr')).toMatch(/,50/);
  });

  it('un montant absent ne s’affiche pas « 0,00 € » : il s’affiche « - »', () => {
    expect(formatPrice(null)).toBe('-');
    expect(formatPrice(undefined)).toBe('-');
    expect(formatPriceShort(null)).toBe('-');
  });

  it('un zéro RÉEL reste un zéro affiché', () => {
    expect(formatPrice(0, 'EUR', 'fr')).not.toBe('-');
  });

  it('une devise inconnue ne fait pas tomber l’écran', () => {
    expect(() => formatPrice(2600, 'XXXX')).not.toThrow();
    expect(formatPrice(2600, 'XXXX')).toContain('26');
  });
});

describe('calculateDistanceKm — Haversine', () => {
  it('Paris → Brazzaville : un peu plus de 6 000 km', () => {
    const km = calculateDistanceKm(48.8566, 2.3522, -4.2634, 15.2429);
    expect(km).not.toBeNull();
    expect(km as number).toBeGreaterThan(5900);
    expect(km as number).toBeLessThan(6200);
  });

  it('deux fois le même point : zéro', () => {
    expect(calculateDistanceKm(48.8566, 2.3522, 48.8566, 2.3522)).toBeCloseTo(0, 6);
  });

  it('une coordonnée manquante rend null — jamais une distance inventée', () => {
    expect(calculateDistanceKm(null, 2.3522, -4.2634, 15.2429)).toBeNull();
    expect(calculateDistanceKm(48.8566, 2.3522, -4.2634, null)).toBeNull();
  });
});

describe('calculateCO2SavedKg — le facteur est en g/kg/km', () => {
  it('tient compte du POIDS : oublier le colis annoncerait l’émission d’un kilo', () => {
    const origin = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: -4.2634, lng: 15.2429 };
    const forOneKg = calculateCO2SavedKg('PLANE', origin, destination, 1) as number;
    const forTenKg = calculateCO2SavedKg('PLANE', origin, destination, 10) as number;
    expect(forTenKg).toBeCloseTo(forOneKg * 10, 5);
  });

  it('le colis de référence pèse 2 kg quand rien n’est dit', () => {
    const origin = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: -4.2634, lng: 15.2429 };
    expect(calculateCO2SavedKg('PLANE', origin, destination)).toBe(
      calculateCO2SavedKg('PLANE', origin, destination, 2)
    );
  });

  it('un colis très léger est compté au minimum de 0,5 kg', () => {
    const origin = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: -4.2634, lng: 15.2429 };
    expect(calculateCO2SavedKg('PLANE', origin, destination, 0.1)).toBe(
      calculateCO2SavedKg('PLANE', origin, destination, 0.5)
    );
  });

  it('l’avion évite beaucoup plus que le train — le fret express est la référence', () => {
    const origin = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: 43.2965, lng: 5.3698 };
    const plane = calculateCO2SavedKg('PLANE', origin, destination) as number;
    const train = calculateCO2SavedKg('TRAIN', origin, destination) as number;
    expect(plane).toBeGreaterThan(train);
  });

  it('un mode inconnu ou absent ne rend rien', () => {
    const origin = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: -4.2634, lng: 15.2429 };
    expect(calculateCO2SavedKg(null, origin, destination)).toBeNull();
    expect(calculateCO2SavedKg('BOAT', origin, destination)).toBeNull();
    expect(calculateCO2SavedKg('PLANE', { lat: null, lng: null }, destination)).toBeNull();
  });
});

describe('les dates — des TABLES, jamais le moteur', () => {
  it('la date longue porte le jour de la semaine, dans l’ordre de la langue', () => {
    expect(formatLongDate(LOCAL_NOON, 'fr')).toBe('Samedi 20 mars 2027');
    expect(formatLongDate(LOCAL_NOON, 'en')).toBe('Saturday March 20, 2027');
  });

  it('le jour-mois est celui des bornes de recherche', () => {
    expect(formatDayMonth(new Date(2027, 2, 20), 'fr')).toBe('20 mars');
    expect(formatDayMonth(new Date(2027, 2, 20), 'en')).toBe('March 20');
  });

  it('le titre d’un mois de calendrier est capitalisé', () => {
    expect(formatMonthYear(new Date(2027, 9, 1), 'fr')).toBe('Octobre 2027');
    expect(formatMonthYear(new Date(2027, 9, 1), 'en')).toBe('October 2027');
  });

  it('l’ancienneté d’un membre se dit en mois et année', () => {
    expect(formatMemberSince(new Date(2026, 0, 10, 12, 0, 0).toISOString(), 'fr')).toBe(
      'janvier 2026'
    );
  });

  it('une date absente ou illisible rend une chaîne VIDE, jamais « Invalid Date »', () => {
    expect(formatLongDate(null)).toBe('');
    expect(formatLongDate('pas une date')).toBe('');
    expect(formatMemberSince(null)).toBe('');
    expect(formatMemberSince('pas une date')).toBe('');
    expect(formatDayMonth(new Date('pas une date'))).toBe('');
  });

  it('les en-têtes de colonnes suivent la semaine locale, deux lettres', () => {
    expect(weekdayLabels(1, 'fr')).toEqual(['LU', 'MA', 'ME', 'JE', 'VE', 'SA', 'DI']);
    expect(weekdayLabels(0, 'fr')[0]).toBe('DI');
    expect(weekdayLabels(0, 'en')).toEqual(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  });
});

describe('formatLocalTime — l’heure du BILLET prime (D24)', () => {
  it('l’heure locale servie l’emporte sur l’ISO', () => {
    expect(formatLocalTime(LOCAL_NOON, '09:30')).toBe('09:30');
  });

  it('sans heure locale, l’ISO est un SECOURS', () => {
    expect(formatLocalTime(LOCAL_NOON, null)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('sans rien, rien', () => {
    expect(formatLocalTime(null, null)).toBe('');
    expect(formatLocalTime('pas une date', null)).toBe('');
  });
});

describe('les durées', () => {
  it('se lisent « 2h37 », « 1j 4h », « 45min »', () => {
    expect(formatMinutesDuration(157)).toBe('2h37');
    expect(formatMinutesDuration(1680)).toBe('1j 4h');
    expect(formatMinutesDuration(45)).toBe('45min');
  });

  it('les heures pleines et les jours pleins ne traînent pas de zéro', () => {
    expect(formatMinutesDuration(120)).toBe('2h');
    expect(formatMinutesDuration(1440)).toBe('1j');
  });

  it('les minutes sont sur deux chiffres dans une heure', () => {
    expect(formatMinutesDuration(65)).toBe('1h05');
  });

  it('zéro minute est une durée, pas une absence', () => {
    expect(formatMinutesDuration(0)).toBe('0min');
  });

  it('une durée négative n’existe pas : elle rend null', () => {
    expect(formatMinutesDuration(-10)).toBeNull();
  });

  it('la durée d’un trajet se calcule de ses deux bornes, et exige les deux', () => {
    expect(
      formatTripDuration({
        departureAt: '2027-03-20T08:30:00.000Z',
        arrivalAt: '2027-03-20T15:05:00.000Z',
        departureTimeLocal: null,
        arrivalTimeLocal: null,
      })
    ).toBe('6h35');
    expect(
      formatTripDuration({
        departureAt: '2027-03-20T08:30:00.000Z',
        arrivalAt: null,
        departureTimeLocal: null,
        arrivalTimeLocal: null,
      })
    ).toBeNull();
  });
});

describe('cityLabel — « Paris, France » → « Paris »', () => {
  it('ne garde que la ville pour un résumé', () => {
    expect(cityLabel('Paris, France')).toBe('Paris');
    expect(cityLabel('Brazzaville, Congo')).toBe('Brazzaville');
  });

  it('laisse intact ce qui n’a pas de virgule', () => {
    expect(cityLabel('Brazzaville')).toBe('Brazzaville');
  });

  it('retombe sur la valeur entière plutôt que de rendre du vide', () => {
    expect(cityLabel(', France')).toBe(', France');
    expect(cityLabel('')).toBe('');
  });
});

describe('les signaux — de la PRÉSENTATION, pas des règles métier', () => {
  it('le compteur de vues ne s’allume qu’une fois le signal crédible', () => {
    expect(showsViews(MIN_SHOWN_VIEWS - 1)).toBe(false);
    expect(showsViews(MIN_SHOWN_VIEWS)).toBe(true);
  });

  it('« Populaire » arrive plus tard que le compteur', () => {
    expect(POPULAR_VIEWS).toBeGreaterThan(MIN_SHOWN_VIEWS);
    expect(isPopular(POPULAR_VIEWS - 1)).toBe(false);
    expect(isPopular(POPULAR_VIEWS)).toBe(true);
  });

  it('un compteur ABSENT (Redis indisponible) n’allume rien', () => {
    expect(showsViews(null)).toBe(false);
    expect(showsViews(undefined)).toBe(false);
    expect(isPopular(null)).toBe(false);
  });
});

describe('getInitials', () => {
  it('assemble l’initiale du prénom et celle du nom', () => {
    expect(getInitials('Serge', 'M')).toBe('SM');
  });

  it('ne rend jamais du vide — « ? » plutôt qu’un cercle muet', () => {
    expect(getInitials('', '')).toBe('?');
  });
});
