/**
 * mes-trajets.spec.ts — la liste du Voyageur (D111 quinquies).
 * =============================================================
 * Ce que ces fiches tiennent, et surtout ce qu'elles REFUSENT :
 *   ① l'app ne décide jamais ce qu'elle peut faire — elle lit
 *     `allowedActions`, calculé par la machine à états du serveur, qui
 *     connaît les réservations en cours (D72) ;
 *   ② la projection ne fait pas confiance à la base (site, anciennes
 *     versions de l'app, seeds) ;
 *   ③ une section vide ne s'affiche pas, et un tri ne met jamais une ligne
 *     sans date au milieu des autres.
 */
import {
  SECTIONS,
  actionMiseEnAvant,
  compteEnCours,
  grouperLesTrajets,
  peut,
  sectionDuStatut,
  trajetDeLApi,
  type TrajetDeLaListe,
} from '@/lib/mes-trajets';

function brut(extra: Record<string, unknown> = {}) {
  return {
    id: 'trajet-1',
    status: 'PUBLISHED',
    originCity: 'Paris',
    destinationCity: 'Berlin',
    departureDateLocal: '2026-11-28',
    departureTimeLocal: '10:00',
    pricePerKgCents: 1000,
    capacityKg: 12,
    allowedActions: ['view', 'viewPublic', 'pause', 'cancel', 'edit'],
    ...extra,
  };
}

function projete(extra: Record<string, unknown> = {}): TrajetDeLaListe {
  const trajet = trajetDeLApi(brut(extra));
  expect(trajet).not.toBeNull();
  return trajet as TrajetDeLaListe;
}

describe('① la projection ne fait pas confiance à la base', () => {
  it('lit ce qu’elle reconnaît', () => {
    expect(projete()).toEqual({
      id: 'trajet-1',
      statut: 'PUBLISHED',
      depart: 'Paris',
      arrivee: 'Berlin',
      dateDepart: '2026-11-28',
      heureDepart: '10:00',
      prixParKiloCents: 1000,
      capaciteKg: 12,
      actions: ['view', 'viewPublic', 'pause', 'cancel', 'edit'],
    });
  });

  it('jette une ligne sans identifiant ou sans statut connu', () => {
    // Une ligne qu'on ne sait pas nommer ne s'affiche pas : mieux vaut une
    // liste plus courte qu'une carte vide sur laquelle rien ne marche.
    expect(trajetDeLApi({ status: 'PUBLISHED' })).toBeNull();
    expect(trajetDeLApi({ id: 'x', status: 'EN_VOL' })).toBeNull();
    expect(trajetDeLApi(null)).toBeNull();
    expect(trajetDeLApi('un trajet')).toBeNull();
  });

  it('un trajet sans ville, sans date et sans prix reste LISIBLE', () => {
    // C'est exactement un brouillon à peine commencé.
    const trajet = projete({
      status: 'DRAFT',
      originCity: undefined,
      destinationCity: undefined,
      departureDateLocal: undefined,
      pricePerKgCents: undefined,
      capacityKg: undefined,
    });
    expect(trajet.depart).toBe('');
    expect(trajet.dateDepart).toBeNull();
    expect(trajet.prixParKiloCents).toBeNull();
  });

  it('sans `allowedActions`, AUCUNE action n’est proposée', () => {
    // Le défaut sûr : ne rien promettre. Supposer « c'est sûrement
    // modifiable » afficherait un bouton que le serveur refuserait.
    const trajet = projete({ allowedActions: undefined });
    expect(trajet.actions).toEqual([]);
    expect(actionMiseEnAvant(trajet)).toBeNull();
  });
});

describe('② l’app LIT les actions, elle ne les déduit pas', () => {
  it('« annuler » n’apparaît que si le serveur l’autorise', () => {
    // D72 : un trajet qui porte une réservation vivante ne s'annule pas, et
    // seul le serveur connaît les réservations.
    expect(peut(projete(), 'cancel')).toBe(true);
    expect(peut(projete({ allowedActions: ['view'] }), 'cancel')).toBe(false);
  });

  it('un brouillon met en avant « continuer », et seulement s’il est modifiable', () => {
    expect(actionMiseEnAvant(projete({ status: 'DRAFT', allowedActions: ['edit', 'delete'] }))).toBe(
      'continuer'
    );
    expect(actionMiseEnAvant(projete({ status: 'DRAFT', allowedActions: ['view'] }))).toBeNull();
  });

  it('un trajet en ligne met en avant la PAUSE, un trajet en pause le retour en ligne', () => {
    expect(actionMiseEnAvant(projete({ status: 'PUBLISHED' }))).toBe('pause');
    expect(
      actionMiseEnAvant(projete({ status: 'PAUSED', allowedActions: ['resume', 'cancel'] }))
    ).toBe('remettre');
  });

  it('un trajet annulé propose la restauration — qui le rend BROUILLON', () => {
    expect(
      actionMiseEnAvant(projete({ status: 'CANCELLED', allowedActions: ['restore'] }))
    ).toBe('restaurer');
  });

  it('un trajet terminé ou archivé ne met rien en avant', () => {
    expect(actionMiseEnAvant(projete({ status: 'COMPLETED', allowedActions: ['view'] }))).toBeNull();
    expect(actionMiseEnAvant(projete({ status: 'ARCHIVED', allowedActions: ['view'] }))).toBeNull();
  });
});

describe('③ trois sections, et aucune n’est vide', () => {
  it('chaque statut tombe dans une section, et il n’y en a que trois', () => {
    expect(sectionDuStatut('DRAFT')).toBe('aFinaliser');
    expect(sectionDuStatut('PUBLISHED')).toBe('enLigne');
    expect(sectionDuStatut('PAUSED')).toBe('enLigne');
    expect(sectionDuStatut('COMPLETED')).toBe('passes');
    expect(sectionDuStatut('CANCELLED')).toBe('passes');
    expect(sectionDuStatut('ARCHIVED')).toBe('passes');
    expect(SECTIONS).toHaveLength(3);
  });

  it('une section sans trajet DISPARAÎT', () => {
    const groupes = grouperLesTrajets([projete({ status: 'DRAFT' })]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].section).toBe('aFinaliser');
  });

  it('les sections gardent leur ordre : à finaliser, en ligne, passés', () => {
    const groupes = grouperLesTrajets([
      projete({ id: 'a', status: 'COMPLETED' }),
      projete({ id: 'b', status: 'PUBLISHED' }),
      projete({ id: 'c', status: 'DRAFT' }),
    ]);
    expect(groupes.map((g) => g.section)).toEqual(['aFinaliser', 'enLigne', 'passes']);
  });

  it('« en ligne » est trié par date de départ CROISSANTE — le prochain voyage d’abord', () => {
    const groupes = grouperLesTrajets([
      projete({ id: 'tard', departureDateLocal: '2026-12-20' }),
      projete({ id: 'tot', departureDateLocal: '2026-11-26' }),
    ]);
    expect(groupes[0].trajets.map((t) => t.id)).toEqual(['tot', 'tard']);
  });

  it('un trajet SANS date passe en dernier, jamais au milieu', () => {
    const groupes = grouperLesTrajets([
      projete({ id: 'sans', departureDateLocal: undefined }),
      projete({ id: 'avec', departureDateLocal: '2026-12-01' }),
    ]);
    expect(groupes[0].trajets.map((t) => t.id)).toEqual(['avec', 'sans']);
  });

  it('les brouillons gardent l’ordre du serveur — le plus récent d’abord', () => {
    const groupes = grouperLesTrajets([
      projete({ id: 'recent', status: 'DRAFT', departureDateLocal: '2027-01-01' }),
      projete({ id: 'vieux', status: 'DRAFT', departureDateLocal: '2026-11-26' }),
    ]);
    expect(groupes[0].trajets.map((t) => t.id)).toEqual(['recent', 'vieux']);
  });

  it('aucun trajet : aucun groupe (l’écran montre son état vide)', () => {
    expect(grouperLesTrajets([])).toEqual([]);
  });
});

describe('④ le compte annoncé en tête', () => {
  it('compte ce qui est EN COURS, pas ce qui est passé', () => {
    const trajets = [
      projete({ id: 'a', status: 'DRAFT' }),
      projete({ id: 'b', status: 'PUBLISHED' }),
      projete({ id: 'c', status: 'PAUSED' }),
      projete({ id: 'd', status: 'COMPLETED' }),
      projete({ id: 'e', status: 'CANCELLED' }),
    ];
    expect(compteEnCours(trajets)).toBe(3);
  });

  it('zéro quand tout est passé — et c’est un vrai zéro, pas une absence', () => {
    expect(compteEnCours([projete({ status: 'ARCHIVED' })])).toBe(0);
  });
});
