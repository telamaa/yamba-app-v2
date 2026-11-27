/**
 * trip-local-dates.spec.ts — la date locale d'un trajet (D111 quinquies).
 * ========================================================================
 * Le défaut, trouvé en confrontant « Mes trajets » à la VRAIE base de
 * recette : `departureDateLocal` est optionnel, et le serveur ne le calcule
 * jamais (`data.departureDateLocal ?? null`) — seul un formulaire de
 * création l'écrit. Trois trajets sur cinq ne l'avaient pas, dont deux
 * PUBLIÉS et trouvables en recherche ; l'écran annonçait « Date à choisir »
 * sur des trajets qui ont une date de départ.
 *
 * Le dépôt avait déjà la correction — `ANO-WEB-41`, côté site, dont
 * l'en-tête nommait même « futur client mobile » comme cause. C'est la
 * leçon d'A224 lot 4 : quand on corrige une classe de défaut, la première
 * question n'est pas « comment » mais « où est-ce déjà corrigé ».
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  localDateTime,
  withLocalDates,
  withLocalDatesInList,
  type TripDatesLike,
} from '@/lib/trip-local-dates';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

describe('① la conversion est EXACTE, parce qu’elle a le fuseau', () => {
  it('rend le jour et l’heure du LIEU, pas ceux de l’appareil', () => {
    // 07:18 UTC un 23 novembre, c'est 08:18 à Paris (CET, UTC+1 en hiver).
    expect(localDateTime('2026-11-23T07:18:42.842Z', 'Europe/Paris')).toEqual({
      date: '2026-11-23',
      time: '08:18',
    });
    // Le même instant, à Brazzaville (WAT, UTC+1 toute l'année).
    expect(localDateTime('2026-11-23T07:18:42.842Z', 'Africa/Brazzaville')).toEqual({
      date: '2026-11-23',
      time: '08:18',
    });
    // Et à Dubaï (UTC+4) : même instant, autre heure.
    expect(localDateTime('2026-11-23T07:18:42.842Z', 'Asia/Dubai')).toEqual({
      date: '2026-11-23',
      time: '11:18',
    });
  });

  it('change de JOUR quand le fuseau le commande — c’est tout l’enjeu', () => {
    // 23:30 UTC le 24, c'est déjà le 25 à Dubaï. Déduire le jour SANS le
    // fuseau se tromperait d'une journée ici, et c'est exactement pourquoi
    // D111 quater 2C refuse la déduction pour PUBLIER. Avec le fuseau, la
    // conversion n'est plus une devinette.
    expect(localDateTime('2026-11-24T23:30:00.000Z', 'Asia/Dubai')).toEqual({
      date: '2026-11-25',
      time: '03:30',
    });
    expect(localDateTime('2026-11-24T23:30:00.000Z', 'Europe/Paris')).toEqual({
      date: '2026-11-25',
      time: '00:30',
    });
  });

  it('écrit l’heure sur 24 h, jamais « 11:18 PM »', () => {
    // `hourCycle: 'h23'` : ces chaînes sont du STOCKAGE, relu par des écrans
    // qui les formatent ensuite dans la langue du lecteur (D108).
    expect(localDateTime('2026-11-23T22:05:00.000Z', 'Europe/Paris')?.time).toBe('23:05');
    expect(localDateTime('2026-11-23T00:05:00.000Z', 'Europe/Paris')?.time).toBe('01:05');
  });

  it('accepte un objet Date aussi bien qu’une chaîne', () => {
    const attendu = { date: '2026-11-23', time: '08:18' };
    expect(localDateTime(new Date('2026-11-23T07:18:42.842Z'), 'Europe/Paris')).toEqual(attendu);
  });
});

describe('② elle se tait plutôt que d’inventer', () => {
  it('sans instant, rien', () => {
    expect(localDateTime(null, 'Europe/Paris')).toBeNull();
    expect(localDateTime(undefined, 'Europe/Paris')).toBeNull();
    expect(localDateTime('', 'Europe/Paris')).toBeNull();
  });

  it('un instant illisible rend `null`, il ne rend pas « NaN »', () => {
    // La famille de défauts d'A224 lots 3 et 4 : toute comparaison avec NaN
    // est fausse, donc une cascade de `if` laisse passer la valeur jusqu'au
    // dernier `return` sans qu'aucune condition l'ait choisie.
    expect(localDateTime('pas une date', 'Europe/Paris')).toBeNull();
    expect(localDateTime(new Date('nawak'), 'Europe/Paris')).toBeNull();
  });

  it('un fuseau inconnu du moteur ne fait pas tomber l’écran', () => {
    // Repli sur le fuseau de l'appareil : une date approchée d'une heure
    // vaut mieux que « 1 janv. 1970 », qui est le défaut que ce fichier
    // existe pour tuer. On épingle la FORME, pas la valeur — elle dépend du
    // fuseau de la machine qui joue la fiche.
    const sortie = localDateTime('2026-11-23T07:18:42.842Z', 'Mars/Olympus_Mons');
    expect(sortie).not.toBeNull();
    expect(sortie?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sortie?.time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('③ ce que le Voyageur a SAISI garde la priorité', () => {
  const trajet = {
    departureDateLocal: '2026-11-25',
    departureTimeLocal: '21:00',
    departureAt: '2026-11-25T20:00:00.000Z',
    originTimezone: 'Europe/Paris',
  };

  it('les chaînes existantes ne sont jamais réécrites', () => {
    expect(withLocalDates(trajet)).toEqual(trajet);
  });

  it('les chaînes absentes sont comblées', () => {
    const comble = withLocalDates({
      departureAt: '2026-11-18T07:18:42.842Z',
      originTimezone: 'Europe/Paris',
      arrivalAt: '2026-11-18T14:00:00.000Z',
      destinationTimezone: 'Africa/Brazzaville',
    });
    expect(comble.departureDateLocal).toBe('2026-11-18');
    expect(comble.departureTimeLocal).toBe('08:18');
    expect(comble.arrivalDateLocal).toBe('2026-11-18');
    expect(comble.arrivalTimeLocal).toBe('15:00');
  });

  it('une chaîne VIDE compte comme absente', () => {
    // `""` est ce que sert une base où le champ a été écrit puis effacé.
    const comble = withLocalDates({
      departureDateLocal: '',
      departureAt: '2026-11-18T07:18:42.842Z',
      originTimezone: 'Europe/Paris',
    });
    expect(comble.departureDateLocal).toBe('2026-11-18');
  });

  it('sans aucun instant, le trajet ressort TEL QUEL', () => {
    const nu = { departureDateLocal: null, originCity: 'Paris' };
    expect(withLocalDates(nu)).toBe(nu);
  });

  it('un trajet sans fuseau est quand même daté — repli sur l’appareil', () => {
    // C'est le cas des trajets écrits par l'app : ils portent les chaînes
    // locales mais pas le fuseau. La RÉCIPROQUE des trajets du seed, qui
    // portent le fuseau et pas les chaînes. Les deux populations se
    // couvrent l'une l'autre.
    const comble = withLocalDates({ departureAt: '2026-11-18T12:00:00.000Z' });
    expect(comble.departureDateLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('④ la liste entière, dans les deux formes que sert l’API', () => {
  type Enveloppe = { trips: TripDatesLike[]; count: number };
  const brut: TripDatesLike = {
    departureAt: '2026-11-18T07:18:42.842Z',
    originTimezone: 'Europe/Paris',
  };

  it('un tableau nu', () => {
    const sortie = withLocalDatesInList([brut]) as TripDatesLike[];
    expect(sortie[0].departureDateLocal).toBe('2026-11-18');
  });

  it('une enveloppe `{ trips }` — la forme réelle de `GET /trips/my`', () => {
    // Variable et non littéral : un littéral déclenche le contrôle des
    // propriétés en trop sur `count`, qui ne regarde pas la fonction.
    const enveloppe: Enveloppe = { trips: [brut], count: 1 };
    const sortie = withLocalDatesInList(enveloppe) as Enveloppe;
    expect(sortie.trips[0].departureDateLocal).toBe('2026-11-18');
    expect(sortie.count).toBe(1); // le reste de l'enveloppe survit
  });

  it('rien du tout ne casse rien', () => {
    expect(withLocalDatesInList(null)).toBeNull();
    expect(withLocalDatesInList(undefined)).toBeUndefined();
    expect(withLocalDatesInList({})).toEqual({});
  });
});

describe('⑤ où la normalisation est branchée, et où elle ne l’est PAS', () => {
  // Ces deux fiches lisent la SOURCE : `my-trips.api.ts` tire `client.ts` →
  // `base-url.ts` → `expo-constants`, que ce harnais (`testEnvironment:
  // node`) ne sait pas charger. C'est la frontière A223, payée pour la
  // troisième fois (D102, D105) — on lit le fichier, on ne l'importe pas.
  it('la LISTE normalise au bord de la lecture', () => {
    const source = readFileSync(join(MOBILE, 'src/lib/api/my-trips.api.ts'), 'utf8');
    expect(source).toContain("from '@/lib/trip-local-dates'");
    expect(source).toMatch(/withLocalDates\(trajet\)/);
  });

  it('la REPRISE d’un brouillon ne normalise pas — et c’est D111 quater 2C', () => {
    // Publier à la mauvaise date est pire que redemander la date : le
    // mapper inverse ne doit RIEN déduire. Afficher une ligne de liste et
    // préremplir un formulaire de publication ne se paient pas pareil.
    const source = readFileSync(join(MOBILE, 'src/lib/api/publish.api.ts'), 'utf8');
    expect(source).not.toContain('trip-local-dates');
    expect(readFileSync(join(MOBILE, 'src/lib/publish-reverse.ts'), 'utf8')).not.toContain(
      'trip-local-dates'
    );
  });
});

describe('⑥ les deux copies du domaine sont la MÊME', () => {
  it('octet pour octet', () => {
    const ici = readFileSync(join(MOBILE, 'src/lib/trip-local-dates.ts'), 'utf8');
    const la = readFileSync(join(WEB, 'src/lib/trip-local-dates.ts'), 'utf8');
    expect(la).toBe(ici);
  });

  it('le site branche la sienne à la lecture, dans ses hooks', () => {
    const hook = readFileSync(join(WEB, 'src/hooks/useTrip.ts'), 'utf8');
    expect(hook).toContain('withLocalDates');
    expect(hook).toContain('withLocalDatesInList');
  });
});
