/**
 * publish-reverse.spec.ts — relire un brouillon serveur (D111 quater).
 * =====================================================================
 * Le chemin inverse de `publish-payload.ts`, et le plus exposé : la réponse
 * vient d'une base où des trajets ont été écrits par le site, par des
 * versions antérieures de l'app et par des seeds. Tout champ peut manquer.
 *
 * La fiche la plus utile du lot est l'ALLER-RETOUR : un brouillon transformé
 * en corps, relu, doit rendre le même brouillon. C'est la seule façon de
 * garantir que les deux mappers ne divergent pas — ils sont écrits à la
 * main, l'un en face de l'autre.
 */
import { brouillonDepuisLeTrajet, lieuxRelus, resumeDuBrouillon } from '@/lib/publish-reverse';
import { construireCorps } from '@/lib/publish-payload';
import { famillesParDefaut, lieuxParDefaut, type PublishDraft } from '@/lib/publish-trip';

function brouillonComplet(): PublishDraft {
  const familles = famillesParDefaut();
  familles.ELECTRONICS_DEVICES = { mode: 'REFUSE', surchargePct: 20 };
  familles.FOOD_DRY_SEALED = { mode: 'SURCHARGE', surchargePct: 25 };
  return {
    tripId: 'trajet-1',
    mode: 'PLANE',
    sousType: 'WITH_LAYOVER',
    escales: 'Istanbul, Doha',
    depart: {
      ville: 'Paris',
      pays: 'France',
      libelle: 'Paris, France',
      placeId: 'place-paris',
      countryCode: 'FR',
      lat: 48.8566,
      lng: 2.3522,
    },
    arrivee: {
      ville: 'Dubaï',
      pays: 'Émirats arabes unis',
      libelle: 'Dubaï, Émirats arabes unis',
      placeId: 'place-dubai',
      countryCode: 'AE',
      lat: 25.2048,
      lng: 55.2708,
    },
    dateDepart: '2026-11-28',
    heureDepart: '21:00',
    dateArrivee: '2026-11-29',
    heureArrivee: '06:30',
    reference: 'AF1234',
    billet: null,
    prixParKiloEur: 9.5,
    capaciteKg: 23,
    forfaitSouteEur: 40,
    forfaitCabineEur: 25,
    familles,
    lieuxRemise: lieuxParDefaut('PLANE').map((l, i) =>
      i === 0 ? { ...l, details: 'T2E hall départ' } : l
    ),
    lieuxLivraison: lieuxParDefaut('PLANE'),
    remiseEnMainPropre: true,
    reservationInstantanee: false,
    notes: 'Je réponds vite.',
  };
}

/** Ce que le serveur rendrait d'un corps enregistré (il le relit tel quel). */
function commeLeServeur(draft: PublishDraft) {
  return { ...construireCorps(draft, false), id: draft.tripId ?? 'trajet-1' };
}

describe('l’aller-retour : écrire puis relire rend le MÊME brouillon', () => {
  it('le voyage, les villes, les dates', () => {
    const relu = brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet()));
    const attendu = brouillonComplet();
    expect(relu.mode).toBe(attendu.mode);
    expect(relu.sousType).toBe(attendu.sousType);
    expect(relu.escales).toBe(attendu.escales);
    expect(relu.depart).toEqual(attendu.depart);
    expect(relu.arrivee).toEqual(attendu.arrivee);
    expect(relu.dateDepart).toBe(attendu.dateDepart);
    expect(relu.heureDepart).toBe(attendu.heureDepart);
    expect(relu.dateArrivee).toBe(attendu.dateArrivee);
    expect(relu.heureArrivee).toBe(attendu.heureArrivee);
  });

  it('l’offre, aux centimes près', () => {
    const relu = brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet()));
    expect(relu.prixParKiloEur).toBe(9.5);
    expect(relu.capaciteKg).toBe(23);
    expect(relu.forfaitSouteEur).toBe(40);
    expect(relu.forfaitCabineEur).toBe(25);
  });

  it('les familles : seuls les ÉCARTS voyagent, et ils reviennent tous', () => {
    const relu = brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet()));
    expect(relu.familles.ELECTRONICS_DEVICES).toEqual({ mode: 'REFUSE', surchargePct: 20 });
    expect(relu.familles.FOOD_DRY_SEALED).toEqual({ mode: 'SURCHARGE', surchargePct: 25 });
    expect(relu.familles.CLOTHES_TEXTILE.mode).toBe('ACCEPT');
  });

  it('les options, les notes et la référence', () => {
    const relu = brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet()));
    expect(relu.remiseEnMainPropre).toBe(true);
    expect(relu.reservationInstantanee).toBe(false);
    expect(relu.notes).toBe('Je réponds vite.');
    expect(relu.reference).toBe('AF1234');
  });

  it('l’identifiant du trajet devient celui du brouillon', () => {
    expect(brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet())).tripId).toBe('trajet-1');
  });

  it('le BILLET ne revient pas — ses documents sont déjà attachés au trajet', () => {
    // Les re-téléverser en créerait des doublons chez ImageKit comme en base.
    const relu = brouillonDepuisLeTrajet(commeLeServeur(brouillonComplet()));
    expect(relu.billet).toBeNull();
  });
});

describe('les lieux : les cartes ÉTEINTES sont reconstruites', () => {
  it('le serveur ne garde que les lieux actifs ; l’écran récupère les deux', () => {
    const corps = commeLeServeur(brouillonComplet());
    // Une seule carte était allumée côté brouillon (l'aéroport).
    expect(corps.pickupLocations).toHaveLength(1);

    const relu = brouillonDepuisLeTrajet(corps);
    expect(relu.lieuxRemise).toHaveLength(2);
    expect(relu.lieuxRemise[0]).toMatchObject({ kind: 'AIRPORT', actif: true, details: 'T2E hall départ' });
    expect(relu.lieuxRemise[1]).toMatchObject({ kind: 'CITY_AREA', actif: false });
  });

  it('un lieu INCONNU du jeu par défaut est AJOUTÉ, jamais perdu', () => {
    // Un aéroport sur un trajet en voiture, saisi depuis le site : perdre un
    // lieu que le Voyageur a écrit serait pire qu'afficher une carte
    // inattendue.
    const lieux = lieuxRelus(
      [{ kind: 'AIRPORT', details: 'Terminal 1', flexibility: 'EXACT', radiusKm: null }],
      'CAR'
    );
    expect(lieux.map((l) => l.kind)).toEqual(['CITY_AREA', 'AIRPORT']);
    expect(lieux[1].actif).toBe(true);
  });

  it('une souplesse inconnue retombe sur « exact » plutôt que de casser', () => {
    const lieux = lieuxRelus([{ kind: 'AIRPORT', flexibility: 'N’IMPORTE QUOI' }], 'PLANE');
    expect(lieux[0].flexibility).toBe('EXACT');
  });

  it('sans mode, il n’y a aucune carte par défaut — mais les lieux du serveur restent', () => {
    expect(lieuxRelus([], null)).toEqual([]);
    expect(lieuxRelus([{ kind: 'CITY_AREA', flexibility: 'RADIUS', radiusKm: 10 }], null)).toHaveLength(1);
  });
});

describe('la lecture est DÉFENSIVE : la base contient de tout', () => {
  it('un trajet vide ne jette pas, et ne prétend rien', () => {
    const relu = brouillonDepuisLeTrajet({});
    expect(relu.mode).toBeNull();
    expect(relu.depart).toBeNull();
    expect(relu.prixParKiloEur).toBeNull();
    expect(relu.notes).toBe('');
    expect(Object.keys(relu.familles)).toHaveLength(8);
  });

  it('un sous-type qui n’appartient pas au mode est IGNORÉ', () => {
    // Un `flightType` traîné sur un trajet en voiture (brouillon modifié) :
    // le recopier referait une combinaison que le serveur refuse.
    const relu = brouillonDepuisLeTrajet({ transportMode: 'CAR', flightType: 'DIRECT' });
    expect(relu.sousType).toBeNull();
  });

  it('un mode inconnu vaut `null`, pas une chaîne au hasard', () => {
    expect(brouillonDepuisLeTrajet({ transportMode: 'BATEAU' }).mode).toBeNull();
  });

  it('un prix à zéro ou négatif ne revient pas — c’est une absence', () => {
    expect(brouillonDepuisLeTrajet({ pricePerKgCents: 0 }).prixParKiloEur).toBeNull();
    expect(brouillonDepuisLeTrajet({ pricePerKgCents: -500 }).prixParKiloEur).toBeNull();
  });

  it('une famille inconnue du contrat est ignorée', () => {
    const relu = brouillonDepuisLeTrajet({
      familyConditions: [{ familyKey: 'DRAGONS', mode: 'REFUSE' }],
    });
    expect(Object.values(relu.familles).every((f) => f.mode === 'ACCEPT')).toBe(true);
  });

  it('un supplément sans pourcentage retombe sur la valeur par défaut', () => {
    const relu = brouillonDepuisLeTrajet({
      familyConditions: [{ familyKey: 'PARTS_TOOLS', mode: 'SURCHARGE' }],
    });
    expect(relu.familles.PARTS_TOOLS).toEqual({ mode: 'SURCHARGE', surchargePct: 20 });
  });

  it('une ville sans libellé s’en fabrique un lisible', () => {
    const relu = brouillonDepuisLeTrajet({ originCity: 'Lyon', originCountry: 'France' });
    expect(relu.depart?.libelle).toBe('Lyon, France');
  });
});

describe('le résumé affiché sur l’écran de seuil', () => {
  it('rend les deux villes quand elles existent', () => {
    expect(resumeDuBrouillon({ originCity: 'Paris', destinationCity: 'Berlin' })).toEqual({
      depart: 'Paris',
      arrivee: 'Berlin',
    });
  });

  it('rend `null` quand il manque une ville — on ne montre pas « Paris → » ', () => {
    // Un séparateur rendu sans son second membre est le défaut de D100 3B.
    expect(resumeDuBrouillon({ originCity: 'Paris' })).toBeNull();
    expect(resumeDuBrouillon({})).toBeNull();
  });
});
