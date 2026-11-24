/**
 * publish-payload.spec.ts — ce que le serveur reçoit (lot « Publier »).
 * ======================================================================
 * Le jumeau du site (`create-trip.mapper.ts`) n'a JAMAIS eu de fiche : il
 * vivait dans `apps/user-ui`, l'app que dix-neuf contrôles ne regardaient pas
 * (A224). C'est pourtant la dernière règle avant le réseau — celle qui décide
 * si une annonce part juste ou fausse.
 *
 * Les quatre choses que ces fiches tiennent :
 *   ① les montants sont des CENTS ENTIERS ;
 *   ② une famille acceptée ne voyage pas (liste vide = tout accepté) ;
 *   ③ un lieu éteint ne voyage pas, et un rayon ne voyage qu'avec `RADIUS` ;
 *   ④ les villes traversées partent dans le champ de LEUR mode.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  centsOuNull,
  construireCorps,
  famillesPourLApi,
  instantIso,
  lieuxPourLApi,
  texteOuNull,
  villesTraversees,
} from '@/lib/publish-payload';
import { famillesParDefaut, lieuxParDefaut, type PublishDraft } from '@/lib/publish-trip';

const MOBILE = resolve(__dirname, '../..');
const TRIP = resolve(MOBILE, '../trip-service');

function brouillonComplet(): PublishDraft {
  return {
    mode: 'PLANE',
    sousType: 'WITH_LAYOVER',
    escales: 'Istanbul, Doha',
    depart: { ville: 'Paris', pays: 'France', libelle: 'Paris, France' },
    arrivee: { ville: 'Dubaï', pays: 'Émirats arabes unis', libelle: 'Dubaï, Émirats arabes unis' },
    dateDepart: '2026-11-25',
    heureDepart: '21:00',
    dateArrivee: '2026-11-26',
    heureArrivee: '06:30',
    reference: ' AF1234 ',
    billet: null,
    prixParKiloEur: 9.5,
    capaciteKg: 23,
    forfaitSouteEur: 40,
    forfaitCabineEur: 25,
    familles: famillesParDefaut(),
    lieuxRemise: lieuxParDefaut('PLANE'),
    lieuxLivraison: lieuxParDefaut('PLANE'),
    remiseEnMainPropre: true,
    reservationInstantanee: false,
    notes: '  ',
  };
}

describe('① les montants', () => {
  it('des euros deviennent des cents ENTIERS', () => {
    expect(centsOuNull(9.5)).toBe(950);
    expect(centsOuNull(10.07)).toBe(1007);
    expect(Number.isInteger(centsOuNull(0.1) as number)).toBe(true);
  });

  it('zéro, négatif ou absent ⇒ `null`, jamais 0', () => {
    // 0 est un PRIX (« je transporte gratuitement ») ; l'absence n'en est pas
    // un. Le serveur refuse d'ailleurs `pricePerKgCents: 0` (positive()).
    expect(centsOuNull(0)).toBeNull();
    expect(centsOuNull(-3)).toBeNull();
    expect(centsOuNull(null)).toBeNull();
  });

  it('le corps complet porte le prix en cents, et la capacité en kilos', () => {
    const corps = construireCorps(brouillonComplet(), true);
    expect(corps.pricePerKgCents).toBe(950);
    expect(corps.capacityKg).toBe(23);
    expect(corps.checkedBag23PriceCents).toBe(4000);
    expect(corps.cabinBag12PriceCents).toBe(2500);
  });

  it('RG-B-29 — un forfait que la capacité ne contient pas ne part PAS', () => {
    const corps = construireCorps({ ...brouillonComplet(), capaciteKg: 12 }, true);
    expect(corps.capacityKg).toBe(12);
    expect(corps.checkedBag23PriceCents).toBeNull(); // 23 kg ne tiennent pas dans 12
    expect(corps.cabinBag12PriceCents).toBe(2500);
  });
});

describe('② les familles', () => {
  it('tout accepté ⇒ liste VIDE (et pas huit lignes « ACCEPT »)', () => {
    expect(famillesPourLApi(famillesParDefaut())).toEqual([]);
  });

  it('seules celles qui s’écartent voyagent, avec leur pourcentage', () => {
    const familles = famillesParDefaut();
    familles.ELECTRONICS_DEVICES = { mode: 'REFUSE', surchargePct: 20 };
    familles.FOOD_DRY_SEALED = { mode: 'SURCHARGE', surchargePct: 30 };
    expect(famillesPourLApi(familles)).toEqual([
      { familyKey: 'FOOD_DRY_SEALED', mode: 'SURCHARGE', surchargePct: 30 },
      { familyKey: 'ELECTRONICS_DEVICES', mode: 'REFUSE' },
    ]);
  });

  it('un REFUS ne porte jamais de pourcentage (le contrat l’interdirait)', () => {
    const familles = famillesParDefaut();
    familles.PARTS_TOOLS = { mode: 'REFUSE', surchargePct: 45 };
    expect(famillesPourLApi(familles)[0]).not.toHaveProperty('surchargePct');
  });
});

describe('③ les lieux', () => {
  it('un lieu éteint ne voyage pas', () => {
    const lieux = lieuxParDefaut('PLANE'); // aéroport allumé, ville éteinte
    expect(lieuxPourLApi(lieux)).toHaveLength(1);
    expect(lieuxPourLApi(lieux)[0].kind).toBe('AIRPORT');
  });

  it('un rayon ne part qu’avec `RADIUS`', () => {
    const lieux = lieuxParDefaut('PLANE').map((lieu) => ({ ...lieu, actif: true, radiusKm: 10 }));
    const api = lieuxPourLApi(lieux);
    expect(api.find((l) => l.flexibility === 'EXACT')?.radiusKm).toBeNull();
    expect(api.find((l) => l.flexibility === 'RADIUS')?.radiusKm).toBe(10);
  });

  it('des précisions vides partent à `null`, jamais en chaîne vide', () => {
    const lieux = lieuxParDefaut('CAR').map((lieu) => ({ ...lieu, details: '   ' }));
    expect(lieuxPourLApi(lieux)[0].details).toBeNull();
  });
});

describe('④ le voyage', () => {
  it('les villes traversées partent dans le champ de LEUR mode', () => {
    const avion = construireCorps(brouillonComplet(), true);
    expect(avion.flightLayoverCities).toEqual(['Istanbul', 'Doha']);
    expect(avion.trainStopCities).toEqual([]);

    const train = construireCorps(
      { ...brouillonComplet(), mode: 'TRAIN', sousType: 'WITH_CONNECTION' },
      true
    );
    expect(train.trainStopCities).toEqual(['Istanbul', 'Doha']);
    expect(train.flightLayoverCities).toEqual([]);
    expect(train.flightType).toBeNull();
    expect(train.trainTripType).toBe('WITH_CONNECTION');
  });

  it('une saisie vide ne donne pas une ville vide', () => {
    expect(villesTraversees('')).toEqual([]);
    expect(villesTraversees(' , , ')).toEqual([]);
    expect(villesTraversees('Istanbul,  ,Doha')).toEqual(['Istanbul', 'Doha']);
  });

  it('l’instant ISO se compose de la date ET de l’heure', () => {
    const iso = instantIso('2026-11-25', '21:00');
    expect(iso).not.toBeNull();
    const relu = new Date(iso as string);
    expect(relu.getFullYear()).toBe(2026);
    expect(relu.getMonth()).toBe(10);
    expect(relu.getDate()).toBe(25);
    expect(relu.getHours()).toBe(21);
  });

  it('sans date, pas d’instant — et une heure seule ne fabrique rien', () => {
    expect(instantIso(null, '21:00')).toBeNull();
  });

  it('les textes facultatifs vides deviennent `null`', () => {
    expect(texteOuNull('  ')).toBeNull();
    expect(texteOuNull(' AF1234 ')).toBe('AF1234');
    const corps = construireCorps(brouillonComplet(), true);
    expect(corps.notes).toBeNull();
    expect(corps.travelReference).toBe('AF1234');
  });

  it('un seul sens : le tunnel ne publie que des allers', () => {
    expect(construireCorps(brouillonComplet(), true).tripType).toBe('ONE_WAY');
  });

  it('la ville est OBLIGATOIRE côté serveur, et c’est elle qu’on remplit', () => {
    const contrat = readFileSync(join(TRIP, 'src/schemas/trip.schema.ts'), 'utf8');
    expect(contrat).toContain('originCity: z.string().trim().min(1).max(150)');
    const corps = construireCorps(brouillonComplet(), true);
    expect(corps.originCity).toBe('Paris');
    expect(corps.destinationCity).toBe('Dubaï');
    expect(corps.originCountry).toBe('France');
    expect(corps.originLabel).toBe('Paris, France');
  });

  it('`publish: false` enregistre un brouillon au lieu de publier', () => {
    expect(construireCorps(brouillonComplet(), false).publish).toBe(false);
  });
});
