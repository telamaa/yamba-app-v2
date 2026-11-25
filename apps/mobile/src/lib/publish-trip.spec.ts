/**
 * publish-trip.spec.ts — publier un trajet depuis le téléphone (lot « Publier »).
 * ===============================================================================
 * Le parcours « Créer un trajet » n'existait que sur le site : 6 436 lignes,
 * vingt et un fichiers, et aucune ligne de test (c'était le constat d'A224 —
 * `apps/user-ui` n'avait aucun harnais). Le téléphone le refait en natif, et
 * les règles sortent de l'écran pour que celles-ci puissent les lire.
 *
 * Ce que les fiches gardent, dans l'ordre d'importance :
 *   ① le vocabulaire est celui du CONTRAT, lu dans `trip.schema.ts` à
 *     l'exécution — une valeur inventée (« WITH_STOPS », « PLANE_DIRECT »)
 *     serait refusée par le serveur et personne ne le verrait avant la
 *     publication. C'est le motif D102, dans l'autre sens : ce que le client
 *     sait ÉMETTRE ;
 *   ② la répartition des manques par écran couvre chaque manque exactement
 *     une fois — un manque qui n'est reproché nulle part referait surface au
 *     moment de publier, c'est-à-dire trop tard ;
 *   ③ les règles de temps ne lisent jamais l'horloge : elles la reçoivent.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  FAMILLES,
  MANQUES_PAR_ECRAN,
  flexibilitesPour,
  manquesDuTunnel,
  manquesLieux,
  memeFlexibilite,
  MODES,
  PHASES_PUBLICATION,
  preparerLeRetour,
  retourPossible,
  SOUS_TYPES,
  dateDepartParDefaut,
  dateIso,
  demandeDesEscales,
  estDansLePasse,
  famillesParDefaut,
  heureParDefaut,
  heureValide,
  lieuxParDefaut,
  manquesDeLEcran,
  manquesVoyage,
  masqueHeure,
  normaliseHeure,
  phaseDeLEcran,
  pretPourLeServeur,
  sousTypePourLApi,
  type Manque,
  type PublishDraft,
} from '@/lib/publish-trip';

const MOBILE = resolve(__dirname, '../..');
const TRIP = resolve(MOBILE, '../trip-service');
const WEB = resolve(MOBILE, '../user-ui');

const CONTRAT = readFileSync(join(TRIP, 'src/schemas/trip.schema.ts'), 'utf8');

/** Les valeurs d'un `z.enum([...])` du contrat, lues dans la source. */
function litLEnum(nom: string): string[] {
  const debut = CONTRAT.indexOf(`export const ${nom} = z.enum(`);
  // D98 — sans cette garde, une tranche vide passerait tous les `toContain`.
  expect(debut).toBeGreaterThanOrEqual(0);
  const fin = CONTRAT.indexOf(']', debut);
  expect(fin).toBeGreaterThan(debut);
  return [...CONTRAT.slice(debut, fin).matchAll(/"([A-Z_0-9]+)"/g)].map((m) => m[1]);
}

/** Un brouillon vierge — les écrans posent leurs valeurs d'office eux-mêmes. */
function brouillonVide(): PublishDraft {
  return {
    tripId: null,
    mode: null,
    sousType: null,
    escales: '',
    depart: null,
    arrivee: null,
    dateDepart: null,
    heureDepart: '',
    dateArrivee: null,
    heureArrivee: '',
    reference: '',
    billet: null,
    prixParKiloEur: null,
    capaciteKg: null,
    forfaitSouteEur: null,
    forfaitCabineEur: null,
    familles: famillesParDefaut(),
    lieuxRemise: [],
    lieuxLivraison: [],
    remiseEnMainPropre: false,
    reservationInstantanee: false,
    notes: '',
  };
}

function ville(nom: string, codePays: string | null = 'FR') {
  return {
    ville: nom,
    pays: 'France',
    libelle: `${nom}, France`,
    placeId: `place-${nom.trim().toLowerCase()}`,
    countryCode: codePays,
    lat: 48.85,
    lng: 2.35,
  };
}

/* ─────────────────────────────────────────────────────────────────────── */

describe('① le téléphone parle la langue du CONTRAT, pas la sienne', () => {
  it('les trois modes sont EXACTEMENT ceux de `TransportModeEnum`', () => {
    expect([...MODES]).toEqual(litLEnum('TransportModeEnum'));
  });

  it('chaque sous-type existe dans l’énumération de SON mode', () => {
    expect([...SOUS_TYPES.PLANE]).toEqual(litLEnum('FlightTypeEnum'));
    expect([...SOUS_TYPES.TRAIN]).toEqual(litLEnum('TrainTripTypeEnum'));
    expect([...SOUS_TYPES.CAR]).toEqual(litLEnum('CarTripFlexibilityEnum'));
  });

  it('les huit familles sont celles du contrat, dans le même ordre', () => {
    // Une famille ajoutée au serveur et oubliée ici disparaîtrait des
    // conditions du Voyageur, sans erreur et sans journal (D102 2A).
    expect([...FAMILLES]).toEqual(litLEnum('ParcelFamilyEnum'));
  });

  it('les lieux proposés d’office n’utilisent que des `kind` et des `flexibility` du contrat', () => {
    const kinds = litLEnum('LocationKindEnum');
    const flex = litLEnum('LocationFlexibilityEnum');
    for (const mode of MODES) {
      for (const lieu of lieuxParDefaut(mode)) {
        expect(kinds).toContain(lieu.kind);
        expect(flex).toContain(lieu.flexibility);
      }
    }
  });

  it('le site nomme les MÊMES huit familles (troisième copie, comparée)', () => {
    const site = readFileSync(
      join(WEB, 'src/components/trips/create/create-trip.config.ts'),
      'utf8'
    );
    const debut = site.indexOf('export const PARCEL_FAMILIES');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = site.indexOf('];', debut);
    const duSite = [...site.slice(debut, fin).matchAll(/key: "([A-Z_]+)"/g)].map((m) => m[1]);
    expect(duSite).toEqual([...FAMILLES]);
  });
});

describe('② le sous-type s’éclate dans le BON champ, et dans un seul', () => {
  it('un vol direct ne remplit que `flightType`', () => {
    expect(sousTypePourLApi('PLANE', 'DIRECT')).toEqual({
      flightType: 'DIRECT',
      trainTripType: null,
      carTripFlexibility: null,
    });
  });

  it('une correspondance ne remplit que `trainTripType`', () => {
    expect(sousTypePourLApi('TRAIN', 'WITH_CONNECTION').trainTripType).toBe('WITH_CONNECTION');
    expect(sousTypePourLApi('TRAIN', 'WITH_CONNECTION').flightType).toBeNull();
  });

  it('un détour ne remplit que `carTripFlexibility`', () => {
    expect(sousTypePourLApi('CAR', 'DETOUR_BY_AGREEMENT').carTripFlexibility).toBe(
      'DETOUR_BY_AGREEMENT'
    );
  });

  it('un sous-type qui n’appartient pas au mode ne remplit RIEN', () => {
    // Le serveur refuserait `trainTripType: "WITH_LAYOVER"` ; surtout, une
    // combinaison impossible vient toujours d'un état d'écran mal remis à
    // zéro — on la neutralise plutôt que de l'envoyer.
    expect(sousTypePourLApi('TRAIN', 'WITH_LAYOVER')).toEqual({
      flightType: null,
      trainTripType: null,
      carTripFlexibility: null,
    });
  });

  it('sans mode, rien ne part', () => {
    expect(sousTypePourLApi(null, 'DIRECT').flightType).toBeNull();
  });

  it('seules l’escale et la correspondance réclament des villes', () => {
    expect(demandeDesEscales('PLANE', 'WITH_LAYOVER')).toBe(true);
    expect(demandeDesEscales('TRAIN', 'WITH_CONNECTION')).toBe(true);
    expect(demandeDesEscales('PLANE', 'DIRECT')).toBe(false);
    expect(demandeDesEscales('CAR', 'DETOUR_BY_AGREEMENT')).toBe(false);
  });
});

describe('③ les lieux proposés d’office suivent le mode', () => {
  it('en avion : l’aéroport allumé, la ville en réserve', () => {
    const lieux = lieuxParDefaut('PLANE');
    expect(lieux.map((l) => l.kind)).toEqual(['AIRPORT', 'CITY_AREA']);
    expect(lieux[0].actif).toBe(true);
    expect(lieux[1].actif).toBe(false);
  });

  it('en train : la gare à la place de l’aéroport', () => {
    expect(lieuxParDefaut('TRAIN').map((l) => l.kind)).toEqual(['TRAIN_STATION', 'CITY_AREA']);
  });

  it('en voiture : la ville seule, dans un rayon', () => {
    const lieux = lieuxParDefaut('CAR');
    expect(lieux).toHaveLength(1);
    expect(lieux[0]).toMatchObject({ kind: 'CITY_AREA', flexibility: 'RADIUS', radiusKm: 10 });
  });

  it('une carte éteinte garde un rayon cohérent — jamais un `RADIUS` sans kilomètres', () => {
    for (const mode of MODES) {
      for (const lieu of lieuxParDefaut(mode)) {
        if (lieu.flexibility === 'RADIUS') expect(lieu.radiusKm).toBeGreaterThan(0);
        else expect(lieu.radiusKm).toBeNull();
      }
    }
  });
});

describe('④ le temps est REÇU, jamais lu', () => {
  const unSoir = new Date(2026, 10, 24, 21, 35); // 24/11/2026, 21 h 35 (local)

  it('la date du jour s’écrit en LOCAL (un `toISOString` décalerait d’un jour)', () => {
    expect(dateIso(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });

  it('le départ proposé d’office est demain', () => {
    expect(dateDepartParDefaut(unSoir)).toBe('2026-11-25');
  });

  it('le départ proposé d’office franchit les fins de mois', () => {
    expect(dateDepartParDefaut(new Date(2026, 11, 31, 10, 0))).toBe('2027-01-01');
  });

  it('l’heure proposée est la prochaine heure pleine, et repasse par minuit', () => {
    expect(heureParDefaut(unSoir)).toBe('22:00');
    expect(heureParDefaut(new Date(2026, 10, 24, 23, 10))).toBe('00:00');
  });

  it('« dans le passé » se juge sur le JOUR, pas sur l’instant', () => {
    expect(estDansLePasse('2026-11-24', unSoir)).toBe(false); // aujourd'hui compte
    expect(estDansLePasse('2026-11-23', unSoir)).toBe(true);
    expect(estDansLePasse('2026-11-25', unSoir)).toBe(false);
  });

  it('une heure valide, c’est `HH:mm` et rien d’autre', () => {
    expect(heureValide('00:00')).toBe(true);
    expect(heureValide('23:59')).toBe(true);
    expect(heureValide('7:05')).toBe(false);
    expect(heureValide('24:00')).toBe(false);
    expect(heureValide('12:60')).toBe(false);
    expect(heureValide('')).toBe(false);
  });
});

describe('⑤ l’heure se tape, et se remet en forme toute seule', () => {
  it('le masque pose les deux points à la troisième frappe', () => {
    expect(masqueHeure('2')).toBe('2');
    expect(masqueHeure('21')).toBe('21');
    expect(masqueHeure('213')).toBe('21:3');
    expect(masqueHeure('2135')).toBe('21:35');
  });

  it('le masque ignore tout ce qui n’est pas un chiffre, et s’arrête à quatre', () => {
    expect(masqueHeure('21h35')).toBe('21:35');
    expect(masqueHeure('213599')).toBe('21:35');
  });

  it('la normalisation rend TOUJOURS `HH:mm`', () => {
    expect(normaliseHeure('9')).toBe('09:00');
    expect(normaliseHeure('21')).toBe('21:00');
    expect(normaliseHeure('930')).toBe('09:30');
    expect(normaliseHeure('2135')).toBe('21:35');
  });

  it('une frappe impossible est RAMENÉE, pas refusée', () => {
    // Refuser efface ce qui a été tapé ; ramener garde l'intention.
    expect(normaliseHeure('2561')).toBe('23:59');
    expect(normaliseHeure('99')).toBe('23:00');
  });

  it('un champ vide reste vide — on n’invente pas minuit', () => {
    expect(normaliseHeure('')).toBe('');
    expect(normaliseHeure('--:--')).toBe('');
  });

  it('ce que le masque produit, la normalisation le valide', () => {
    for (const frappe of ['9', '21', '930', '2135', '0000', '2359']) {
      expect(heureValide(normaliseHeure(masqueHeure(frappe)))).toBe(true);
    }
  });
});

describe('⑥ ce qui manque est nommé, et nommé AU BON ÉCRAN', () => {
  const unSoir = new Date(2026, 10, 24, 21, 35);

  it('un brouillon vierge manque de tout ce qui se saisit', () => {
    expect(manquesVoyage(brouillonVide(), unSoir)).toEqual([
      'mode',
      'depart',
      'arrivee',
      'dateDepart',
      'heureDepart',
      'dateArrivee',
      'heureArrivee',
    ]);
  });

  it('le sous-type n’est réclamé qu’une fois le mode choisi', () => {
    const draft = { ...brouillonVide(), mode: 'PLANE' as const };
    expect(manquesVoyage(draft, unSoir)).toContain('sousType');
    expect(manquesVoyage(draft, unSoir)).not.toContain('mode');
  });

  it('les villes d’escale ne sont réclamées que par un vol AVEC escale', () => {
    const avecEscale = {
      ...brouillonVide(),
      mode: 'PLANE' as const,
      sousType: 'WITH_LAYOVER' as const,
    };
    expect(manquesVoyage(avecEscale, unSoir)).toContain('escales');
    expect(
      manquesVoyage({ ...avecEscale, sousType: 'DIRECT' as const }, unSoir)
    ).not.toContain('escales');
    expect(manquesVoyage({ ...avecEscale, escales: 'Istanbul' }, unSoir)).not.toContain('escales');
  });

  it('partir et arriver dans la même ville n’est pas un trajet', () => {
    const draft = { ...brouillonVide(), depart: ville('Paris'), arrivee: ville('paris  ') };
    expect(manquesVoyage(draft, unSoir)).toContain('memeVille');
  });

  it('une date de départ passée est nommée comme telle, pas comme une absence', () => {
    const draft = { ...brouillonVide(), dateDepart: '2026-11-01' };
    const manques = manquesVoyage(draft, unSoir);
    expect(manques).toContain('dateDepartPassee');
    expect(manques).not.toContain('dateDepart');
  });

  it('une arrivée avant le départ est nommée comme telle', () => {
    const draft = { ...brouillonVide(), dateDepart: '2026-11-25', dateArrivee: '2026-11-24' };
    expect(manquesVoyage(draft, unSoir)).toContain('arriveeAvantDepart');
  });

  it('un trajet complet ne manque de rien', () => {
    const complet: PublishDraft = {
      ...brouillonVide(),
      mode: 'PLANE',
      sousType: 'DIRECT',
      depart: ville('Paris'),
      arrivee: ville('Dubaï'),
      dateDepart: '2026-11-25',
      heureDepart: '21:00',
      dateArrivee: '2026-11-26',
      heureArrivee: '06:30',
    };
    expect(manquesVoyage(complet, unSoir)).toEqual([]);
  });

  it('la répartition couvre chaque manque EXACTEMENT une fois', () => {
    // Un manque oublié de la table ne bloquerait aucun écran et referait
    // surface au moment de publier — c'est-à-dire trop tard, après sept
    // écrans. Un manque présent deux fois serait reproché sur un écran où
    // le champ n'est même pas visible.
    const repartis = [...MANQUES_PAR_ECRAN[1], ...MANQUES_PAR_ECRAN[2]];
    const tous: Manque[] = [
      'mode',
      'sousType',
      'escales',
      'depart',
      'arrivee',
      'memeVille',
      'dateDepart',
      'dateDepartPassee',
      'heureDepart',
      'dateArrivee',
      'arriveeAvantDepart',
      'heureArrivee',
    ];
    expect([...repartis].sort()).toEqual([...tous].sort());
    expect(new Set(repartis).size).toBe(repartis.length);
  });

  it('un écran ne reproche QUE ses propres champs', () => {
    const vide = brouillonVide();
    // ① « Ton voyage » réunit le mode ET les villes depuis la fusion du 25/11.
    expect(manquesDeLEcran(1, vide, unSoir)).toEqual(['mode', 'depart', 'arrivee']);
    expect(manquesDeLEcran(2, vide, unSoir)).toEqual([
      'dateDepart',
      'heureDepart',
      'dateArrivee',
      'heureArrivee',
    ]);
  });
});

describe('⑦ les phases annoncées', () => {
  it('trois phases, et c’est ce chiffre que le lecteur d’écran entend', () => {
    expect(PHASES_PUBLICATION).toHaveLength(3);
  });

  it('chaque écran tombe dans une phase, et la dernière attrape les débordements', () => {
    expect(phaseDeLEcran(1).cle).toBe('trip');
    expect(phaseDeLEcran(2).cle).toBe('trip');
    expect(phaseDeLEcran(3).cle).toBe('conditions');
    expect(phaseDeLEcran(5).cle).toBe('conditions');
    expect(phaseDeLEcran(6).cle).toBe('review');
    // Un écran ajouté demain sans toucher la table ne doit pas rendre `-1`.
    expect(phaseDeLEcran(99).cle).toBe('review');
  });

  it('les huit familles partent toutes ACCEPTÉES — refuser est un choix, pas un défaut', () => {
    const familles = famillesParDefaut();
    expect(Object.keys(familles)).toHaveLength(8);
    expect(Object.values(familles).every((f) => f.mode === 'ACCEPT')).toBe(true);
  });
});

describe('⑧ ce que le téléphone sait ÉMETTRE — et ce qu’il n’invente pas', () => {
  /**
   * CETTE FICHE A CHANGÉ DE SENS, ET C’EST LE POINT.
   *
   * Écrite le 24/11, elle TENAIT UN CONSTAT : le relais Places ne rendait que
   * deux chaînes (ni `placeId`, ni code pays, ni coordonnées), donc le
   * téléphone ne pouvait pas calculer de corridor, donc pas de fourchette de
   * prix. Elle est passée au ROUGE le jour où ce manque a été comblé
   * (D111 ter) — exactement ce qu'on lui demandait de faire.
   *
   * Elle garde désormais l'inverse : que le chemin EXISTE, de bout en bout.
   */
  it('le relais rend l’identifiant du lieu', () => {
    const relais = readFileSync(join(MOBILE, 'src/lib/api/places.api.ts'), 'utf8');
    const debut = relais.indexOf('export type CitySuggestion');
    expect(debut).toBeGreaterThanOrEqual(0);
    const type = relais.slice(debut, relais.indexOf('};', debut));
    expect(type).toContain('placeId');
  });

  it('et le client sait demander le DÉTAIL d’un lieu choisi', () => {
    const relais = readFileSync(join(MOBILE, 'src/lib/api/places.api.ts'), 'utf8');
    expect(relais).toContain('/places/details');
    // Le jeton de session voyage avec : sans lui, Google facture deux
    // requêtes au lieu d'une session.
    expect(relais).toContain('sessionToken');
  });

  it('le serveur expose bien cette route, et elle est PUBLIQUE comme la recherche', () => {
    const TRIP = resolve(MOBILE, '../trip-service');
    const router = readFileSync(join(TRIP, 'src/routes/places.router.ts'), 'utf8');
    expect(router).toContain('"/details"');
    expect(router).toContain('isOptionallyAuthenticated');
  });

  it('le brouillon porte de quoi calculer un corridor, et tout y est NULLABLE', () => {
    // Une saisie libre, un service muet ou une ville sans pays laissent ces
    // champs à `null` : le calcul retombe sur sa base de repli, et l'écran
    // se tait plutôt que d'afficher une médiane qui aurait l'air mesurée.
    const source = readFileSync(join(MOBILE, 'src/lib/publish-trip.ts'), 'utf8');
    const debut = source.indexOf('export type VilleChoisie');
    const type = source.slice(debut, source.indexOf('};', debut));
    expect(type).toContain('countryCode: string | null');
    expect(type).toContain('lat: number | null');
    expect(type).toContain('lng: number | null');
  });

  it('le serveur n’exige toujours que la VILLE — le reste enrichit', () => {
    expect(CONTRAT).toContain('originCity: z.string().trim().min(1).max(150)');
    expect(CONTRAT).toContain('originCountryCode: isoCodeSchema');
    expect(CONTRAT).toContain('originLat: z.number().optional().nullable()');
  });
});

describe('⑨ les lieux : des souplesses qui veulent dire quelque chose', () => {
  it('un aéroport ou une gare peut être EXACT, jamais « toute la ville »', () => {
    for (const kind of ['AIRPORT', 'TRAIN_STATION'] as const) {
      const options = flexibilitesPour(kind);
      expect(options.map((o) => o.flexibility)).toContain('EXACT');
      expect(options.map((o) => o.flexibility)).not.toContain('CITY_WIDE');
    }
  });

  it('une zone de ville n’a pas de point : « exact » ne lui est pas proposé', () => {
    const options = flexibilitesPour('CITY_AREA');
    expect(options.map((o) => o.flexibility)).not.toContain('EXACT');
    expect(options.map((o) => o.flexibility)).toContain('CITY_WIDE');
  });

  it('un rayon proposé porte TOUJOURS ses kilomètres', () => {
    for (const kind of ['AIRPORT', 'TRAIN_STATION', 'CITY_AREA'] as const) {
      for (const option of flexibilitesPour(kind)) {
        if (option.flexibility === 'RADIUS') expect(option.radiusKm).toBeGreaterThan(0);
        else expect(option.radiusKm).toBeNull();
      }
    }
  });

  it('deux souplesses sont la même quand leur rayon coïncide', () => {
    expect(memeFlexibilite({ flexibility: 'RADIUS', radiusKm: 10 }, { flexibility: 'RADIUS', radiusKm: 10 })).toBe(true);
    expect(memeFlexibilite({ flexibility: 'RADIUS', radiusKm: 10 }, { flexibility: 'RADIUS', radiusKm: 5 })).toBe(false);
    expect(memeFlexibilite({ flexibility: 'EXACT', radiusKm: null }, { flexibility: 'CITY_WIDE', radiusKm: null })).toBe(false);
  });

  it('un lieu ÉTEINT ne compte pas comme proposé', () => {
    const lieux = lieuxParDefaut('PLANE').map((lieu) => ({ ...lieu, actif: false }));
    expect(manquesLieux({ lieuxRemise: lieux, lieuxLivraison: lieux })).toEqual([
      'lieuRemise',
      'lieuLivraison',
    ]);
  });

  it('les cartes par défaut suffisent : une est déjà allumée', () => {
    for (const mode of MODES) {
      const lieux = lieuxParDefaut(mode);
      expect(manquesLieux({ lieuxRemise: lieux, lieuxLivraison: lieux })).toEqual([]);
    }
  });
});

describe('⑩ le dernier écran voit TOUT ce qui manque', () => {
  const unSoir = new Date(2026, 10, 24, 21, 35);

  it('un brouillon vierge manque du voyage ET des lieux', () => {
    const manques = manquesDuTunnel(brouillonVide(), unSoir);
    expect(manques).toContain('mode');
    expect(manques).toContain('lieuRemise');
    expect(manques).toContain('lieuLivraison');
  });

  it('un trajet complet ne manque de rien', () => {
    const lieux = lieuxParDefaut('PLANE');
    const complet: PublishDraft = {
      ...brouillonVide(),
      mode: 'PLANE',
      sousType: 'DIRECT',
      depart: ville('Paris'),
      arrivee: ville('Dubaï'),
      dateDepart: '2026-11-25',
      heureDepart: '21:00',
      dateArrivee: '2026-11-26',
      heureArrivee: '06:30',
      lieuxRemise: lieux,
      lieuxLivraison: lieux,
    };
    expect(manquesDuTunnel(complet, unSoir)).toEqual([]);
  });
});

describe('⑪ le retour, préparé depuis l’aller', () => {
  function aller(): PublishDraft {
    const lieuxParis = lieuxParDefaut('PLANE').map((l) => ({ ...l, details: 'T2E' }));
    const lieuxBerlin = lieuxParDefaut('PLANE').map((l) => ({ ...l, details: 'BER T1' }));
    return {
      ...brouillonVide(),
      mode: 'PLANE',
      sousType: 'WITH_LAYOVER',
      escales: 'Vienne',
      depart: ville('Paris'),
      arrivee: ville('Berlin'),
      dateDepart: '2026-11-28',
      heureDepart: '10:00',
      dateArrivee: '2026-11-28',
      heureArrivee: '13:12',
      reference: 'AF1234',
      billet: { url: 'u', fileId: 'f', name: 'n', mimeType: 'image/jpeg', sizeBytes: 10 },
      prixParKiloEur: 10,
      capaciteKg: 12,
      lieuxRemise: lieuxParis,
      lieuxLivraison: lieuxBerlin,
      notes: 'Je réponds vite.',
    };
  }

  it('les deux villes sont inversées', () => {
    const retour = preparerLeRetour(aller());
    expect(retour.depart?.ville).toBe('Berlin');
    expect(retour.arrivee?.ville).toBe('Paris');
  });

  it('les LIEUX suivent les villes — sinon on propose l’aéroport de départ à l’arrivée', () => {
    // Un lieu de REMISE à Paris devient un lieu de LIVRAISON à Paris : même
    // terminal, autre sens de l'échange. C'est l'inversion la plus facile à
    // oublier, et la plus fausse si on l'oublie.
    const retour = preparerLeRetour(aller());
    expect(retour.lieuxRemise[0].details).toBe('BER T1');
    expect(retour.lieuxLivraison[0].details).toBe('T2E');
  });

  it('ce qui fait l’intérêt du geste est GARDÉ : prix, capacité, conditions, mode', () => {
    const retour = preparerLeRetour(aller());
    expect(retour.prixParKiloEur).toBe(10);
    expect(retour.capaciteKg).toBe(12);
    expect(retour.mode).toBe('PLANE');
    expect(retour.sousType).toBe('WITH_LAYOVER');
    expect(retour.notes).toBe('Je réponds vite.');
  });

  it('les dates, la référence et le billet sont EFFACÉS — c’est un autre voyage', () => {
    const retour = preparerLeRetour(aller());
    expect(retour.dateDepart).toBeNull();
    expect(retour.heureDepart).toBe('');
    expect(retour.dateArrivee).toBeNull();
    expect(retour.heureArrivee).toBe('');
    expect(retour.reference).toBe('');
    expect(retour.billet).toBeNull();
  });

  it('il ne reste QUE les dates à poser', () => {
    const retour = preparerLeRetour(aller());
    const unSoir = new Date(2026, 10, 25, 9, 0);
    // Tout ce qui manque au retour appartient à l'écran des dates : c'est
    // exactement la promesse faite à l'écran de fin.
    expect(manquesDeLEcran(1, retour, unSoir)).toEqual([]);
    expect(manquesDeLEcran(2, retour, unSoir).length).toBeGreaterThan(0);
  });

  it('sans villes, il n’y a pas de retour à proposer', () => {
    expect(retourPossible(brouillonVide())).toBe(false);
    expect(retourPossible(aller())).toBe(true);
  });
});

describe('⑫ à partir de quand le brouillon peut être ENREGISTRÉ (D111 quater)', () => {
  it('il faut le mode ET les deux villes — ce que le serveur exige, rien de plus', () => {
    const vide = brouillonVide();
    expect(pretPourLeServeur(vide)).toBe(false);
    expect(pretPourLeServeur({ ...vide, mode: 'PLANE' })).toBe(false);
    expect(pretPourLeServeur({ ...vide, mode: 'PLANE', depart: ville('Paris') })).toBe(false);
    expect(
      pretPourLeServeur({
        ...vide,
        mode: 'PLANE',
        depart: ville('Paris'),
        arrivee: ville('Berlin'),
      })
    ).toBe(true);
  });

  it('une ville faite d’espaces ne compte pas', () => {
    const draft = {
      ...brouillonVide(),
      mode: 'TRAIN' as const,
      depart: ville('Paris'),
      arrivee: { ...ville('Berlin'), ville: '   ' },
    };
    expect(pretPourLeServeur(draft)).toBe(false);
  });

  it('c’est exactement la fin du PREMIER écran', () => {
    // La sauvegarde devient possible au moment où ① n'a plus rien à
    // reprocher : pas avant, et il ne sert à rien d'attendre plus.
    const complet = {
      ...brouillonVide(),
      mode: 'PLANE' as const,
      sousType: 'DIRECT' as const,
      depart: ville('Paris'),
      arrivee: ville('Berlin'),
    };
    expect(manquesDeLEcran(1, complet, new Date(2026, 10, 25))).toEqual([]);
    expect(pretPourLeServeur(complet)).toBe(true);
  });

  it('le RETOUR repart sans identifiant — c’est un autre trajet', () => {
    // Reprendre celui de l'aller écraserait le trajet qu'on vient de publier.
    const aller = {
      ...brouillonVide(),
      tripId: 'trajet-publie',
      mode: 'PLANE' as const,
      depart: ville('Paris'),
      arrivee: ville('Berlin'),
    };
    expect(preparerLeRetour(aller).tripId).toBeNull();
  });
});
