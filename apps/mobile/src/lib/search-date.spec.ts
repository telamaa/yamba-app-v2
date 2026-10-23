/**
 * search-date.spec.ts — les deux modes et les trois fenêtres de la recherche.
 * ===========================================================================
 * MIROIR ASSUMÉ du calendrier du site (`SmartDatePicker`) : une recherche
 * lancée du téléphone et la même lancée du navigateur doivent trouver
 * exactement les mêmes trajets. Toute divergence ici est un BUG, pas une
 * variante — c'est écrit dans l'en-tête du module, et c'est ce que ces fiches
 * tiennent.
 *
 * Précaution de fiche : ce module calcule en heure LOCALE de l'appareil (c'est
 * voulu — « cette semaine » est la semaine de celui qui cherche). Les attendus
 * sont donc CONSTRUITS localement eux aussi, jamais écrits en ISO en dur :
 * sinon ces fiches passeraient à Paris et tomberaient sur la CI, qui tourne
 * en UTC.
 */
import {
  FLEX_TYPES,
  dateBounds,
  flexRange,
  isSameDay,
  isWithin,
  makeExact,
  makeFlex,
  monthMatrix,
  monthsFrom,
  rangeLabel,
  startOfDay,
  summaryLabel,
  weekStartFor,
} from '@/lib/search-date';

/** Lundi 15 mars 2027, 14 h 37 — en heure locale, comme l'appareil le voit. */
const MONDAY = new Date(2027, 2, 15, 14, 37, 12, 345);

const LABELS = {
  any: 'Quand ?',
  flex: { thisWeek: 'Cette semaine', thisMonth: 'Ce mois', next3Months: '3 prochains mois' },
};

describe('weekStartFor — la convention exacte du web', () => {
  it('lundi en français, dimanche en anglais', () => {
    expect(weekStartFor('fr')).toBe(1);
    expect(weekStartFor('en')).toBe(0);
  });
});

describe('startOfDay — l’heure disparaît, la date reste', () => {
  it('ramène à minuit local sans toucher au jour', () => {
    const start = startOfDay(MONDAY);
    expect(start.getFullYear()).toBe(2027);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(15);
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
});

describe('flexRange — les trois fenêtres', () => {
  it('« cette semaine » commence le LUNDI en français', () => {
    const { rangeStart, rangeEnd } = flexRange('thisWeek', startOfDay(MONDAY), 1);
    expect(rangeStart.getDay()).toBe(1);
    expect(rangeEnd.getDay()).toBe(0);
    expect(rangeEnd.getDate() - rangeStart.getDate()).toBe(6);
  });

  it('« cette semaine » commence le DIMANCHE en anglais', () => {
    const { rangeStart, rangeEnd } = flexRange('thisWeek', startOfDay(MONDAY), 0);
    expect(rangeStart.getDay()).toBe(0);
    expect(rangeEnd.getDay()).toBe(6);
  });

  it('« ce mois » va du 1er au dernier jour, mars en a 31', () => {
    const { rangeStart, rangeEnd } = flexRange('thisMonth', startOfDay(MONDAY), 1);
    expect(rangeStart.getDate()).toBe(1);
    expect(rangeStart.getMonth()).toBe(2);
    expect(rangeEnd.getDate()).toBe(31);
    expect(rangeEnd.getMonth()).toBe(2);
  });

  it('« 3 prochains mois » va du 1er de CE mois au dernier jour du mois +2', () => {
    const { rangeStart, rangeEnd } = flexRange('next3Months', startOfDay(MONDAY), 1);
    expect([rangeStart.getMonth(), rangeStart.getDate()]).toEqual([2, 1]);
    expect([rangeEnd.getMonth(), rangeEnd.getDate()]).toEqual([4, 31]);
  });

  it('un mois court est respecté (février 2028 en a 29)', () => {
    const { rangeEnd } = flexRange('thisMonth', new Date(2028, 1, 10), 1);
    expect(rangeEnd.getDate()).toBe(29);
  });

  it('franchit l’année sans se tromper (novembre → janvier)', () => {
    const { rangeStart, rangeEnd } = flexRange('next3Months', new Date(2027, 10, 20), 1);
    expect([rangeStart.getFullYear(), rangeStart.getMonth()]).toEqual([2027, 10]);
    expect([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()]).toEqual([2028, 0, 31]);
  });

  it('les trois raccourcis déclarés sont tous calculables', () => {
    for (const flexType of FLEX_TYPES) {
      const { rangeStart, rangeEnd } = flexRange(flexType, startOfDay(MONDAY), 1);
      expect(rangeStart.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());
    }
  });
});

describe('makeExact / makeFlex — les constructeurs', () => {
  it('un jour exact perd son heure', () => {
    const value = makeExact(MONDAY);
    expect(value.mode).toBe('exact');
    expect(value.date.getHours()).toBe(0);
    expect(value.flexType).toBeUndefined();
  });

  it('une fenêtre flexible porte son type ET ses bornes', () => {
    const value = makeFlex('thisWeek', 'fr', MONDAY);
    expect(value.mode).toBe('flex');
    expect(value.flexType).toBe('thisWeek');
    expect(value.rangeStart?.getDay()).toBe(1);
    expect(value.rangeEnd?.getDay()).toBe(0);
  });

  it('la locale change la semaine, pas le mode', () => {
    expect(makeFlex('thisWeek', 'en', MONDAY).rangeStart?.getDay()).toBe(0);
  });
});

describe('dateBounds — ce qui part au serveur', () => {
  it('un jour exact couvre exactement 24 heures', () => {
    const { dateFrom, dateTo } = dateBounds(makeExact(MONDAY));
    expect(dateFrom).toBe(new Date(2027, 2, 15).toISOString());
    expect(dateTo).toBe(new Date(2027, 2, 16).toISOString());
  });

  it('une fenêtre flexible va jusqu’à la FIN de son dernier jour (bornes incluses)', () => {
    const value = makeFlex('thisMonth', 'fr', MONDAY);
    const { dateTo } = dateBounds(value, MONDAY);
    expect(dateTo).toBe(new Date(2027, 3, 1).toISOString());
  });

  it('une fenêtre DÉJÀ COMMENCÉE est ramenée à aujourd’hui — on ne demande pas le passé', () => {
    const value = makeFlex('thisMonth', 'fr', MONDAY);
    const { dateFrom } = dateBounds(value, MONDAY);
    expect(dateFrom).toBe(new Date(2027, 2, 15).toISOString());
  });

  it('une fenêtre ENTIÈREMENT à venir garde son début', () => {
    const value = makeFlex('next3Months', 'fr', new Date(2027, 5, 10));
    const { dateFrom } = dateBounds(value, new Date(2027, 4, 1));
    expect(dateFrom).toBe(new Date(2027, 5, 1).toISOString());
  });

  it('un mode flexible SANS bornes retombe sur le jour unique — jamais sur une fenêtre vide', () => {
    const { dateFrom, dateTo } = dateBounds(
      { mode: 'flex', date: MONDAY, flexType: 'thisWeek' },
      MONDAY
    );
    expect(dateFrom).toBe(new Date(2027, 2, 15).toISOString());
    expect(dateTo).toBe(new Date(2027, 2, 16).toISOString());
  });
});

describe('les deux libellés de la pilule', () => {
  it('rien de choisi : le libellé neutre', () => {
    expect(summaryLabel(null, 'fr', LABELS)).toBe('Quand ?');
  });

  it('un raccourci se nomme par son INTENTION, jamais par ses bornes', () => {
    expect(summaryLabel(makeFlex('thisWeek', 'fr', MONDAY), 'fr', LABELS)).toBe('Cette semaine');
  });

  it('un jour exact se nomme par sa date', () => {
    expect(summaryLabel(makeExact(MONDAY), 'fr', LABELS)).toBe('15 mars');
    expect(summaryLabel(makeExact(MONDAY), 'en', LABELS)).toBe('March 15');
  });

  it('la fenêtre s’écrit en toutes lettres SOUS les raccourcis', () => {
    expect(rangeLabel(makeFlex('thisMonth', 'fr', MONDAY), 'fr')).toBe('1 mars – 31 mars');
  });

  it('un jour exact n’a pas de fenêtre à afficher', () => {
    expect(rangeLabel(makeExact(MONDAY), 'fr')).toBeNull();
  });
});

describe('la grille du calendrier — vingt lignes de calcul, zéro dépendance', () => {
  it('monthsFrom rend des premiers de mois consécutifs', () => {
    const months = monthsFrom(MONDAY, 4);
    expect(months.map((m) => [m.getFullYear(), m.getMonth(), m.getDate()])).toEqual([
      [2027, 2, 1],
      [2027, 3, 1],
      [2027, 4, 1],
      [2027, 5, 1],
    ]);
  });

  it('une matrice de mois ne contient QUE les jours du mois, et des semaines pleines', () => {
    const weeks = monthMatrix(new Date(2027, 2, 1), 1);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    const days = weeks.flat().filter((d): d is Date => d !== null);
    expect(days).toHaveLength(31);
    expect(days.every((d) => d.getMonth() === 2)).toBe(true);
  });

  it('le premier jour tombe dans la bonne colonne (1er mars 2027 = un lundi)', () => {
    const [firstWeek] = monthMatrix(new Date(2027, 2, 1), 1);
    expect(firstWeek[0]?.getDate()).toBe(1);
    const [sundayFirst] = monthMatrix(new Date(2027, 2, 1), 0);
    expect(sundayFirst[0]).toBeNull();
    expect(sundayFirst[1]?.getDate()).toBe(1);
  });

  it('une année bissextile est respectée (février 2028)', () => {
    const days = monthMatrix(new Date(2028, 1, 1), 1).flat().filter(Boolean);
    expect(days).toHaveLength(29);
  });
});

describe('isSameDay / isWithin', () => {
  it('le même jour à des heures différentes reste le même jour', () => {
    expect(isSameDay(MONDAY, new Date(2027, 2, 15, 23, 59))).toBe(true);
    expect(isSameDay(MONDAY, new Date(2027, 2, 16, 0, 1))).toBe(false);
  });

  it('les bornes sont INCLUSES — la fenêtre se peint jusqu’à son dernier jour', () => {
    const start = new Date(2027, 2, 10);
    const end = new Date(2027, 2, 20);
    expect(isWithin(start, start, end)).toBe(true);
    expect(isWithin(end, start, end)).toBe(true);
    expect(isWithin(new Date(2027, 2, 20, 23, 59), start, end)).toBe(true);
    expect(isWithin(new Date(2027, 2, 21), start, end)).toBe(false);
    expect(isWithin(new Date(2027, 2, 9, 23, 59), start, end)).toBe(false);
  });
});
