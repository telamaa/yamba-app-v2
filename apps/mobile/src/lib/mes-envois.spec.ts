/**
 * mes-envois.spec.ts — la liste de l'Expéditeur (D112).
 * ======================================================
 * Ce que ces fiches tiennent :
 *   ① la projection ne fait pas confiance à ce que sert la base ;
 *   ② « À traiter » se déduit de ce que le SERVEUR accorde, jamais d'une
 *      table de statuts recopiée — c'est le point où l'on s'écarte du site,
 *      et il est trop facile à « réaligner » par mégarde pour n'être écrit
 *      que dans un commentaire ;
 *   ③ les sections, leur ordre, et celles qui disparaissent ;
 *   ④ le contrat, dans les DEUX sens : ce que l'app sait émettre, et ce
 *      qu'elle sait lire (leçon D101/D102).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  SECTIONS,
  actionMiseEnAvant,
  compteEnCours,
  envoiDeLApi,
  grouperLesEnvois,
  peut,
  sectionDeLEnvoi,
  type EnvoiDeLaListe,
} from '@/lib/mes-envois';

const MOBILE = resolve(__dirname, '../..');

function brut(extra: Record<string, unknown> = {}) {
  return {
    id: 'envoi-1',
    status: 'ACCEPTED',
    trip: {
      originCity: 'Paris',
      destinationCity: 'Dubaï',
      departureAt: '2026-11-25T20:00:00.000Z',
      originTimezone: 'Europe/Paris',
    },
    pricing: { totalShipperCents: 4250, currencyCode: 'EUR' },
    carrier: { id: 'v1', firstName: 'Thomas', lastInitial: 'N' },
    rating: { canRate: false, ratedByMe: false },
    allowedActions: ['cancel'],
    expiresAt: '2026-11-20T10:00:00.000Z',
    ...extra,
  };
}

function projete(extra: Record<string, unknown> = {}): EnvoiDeLaListe {
  const envoi = envoiDeLApi(brut(extra));
  expect(envoi).not.toBeNull();
  return envoi as EnvoiDeLaListe;
}

describe('① la projection ne fait pas confiance à la base', () => {
  it('lit ce qu’elle reconnaît, et date dans le fuseau du LIEU', () => {
    // 20:00 UTC, c'est 21:00 à Paris : la date se lit au départ, pas sur le
    // téléphone de celui qui regarde (D24).
    expect(projete()).toEqual({
      id: 'envoi-1',
      statut: 'ACCEPTED',
      depart: 'Paris',
      arrivee: 'Dubaï',
      dateDepart: '2026-11-25',
      heureDepart: '21:00',
      voyageur: 'Thomas N.',
      totalCents: 4250,
      devise: 'EUR',
      actions: ['cancel'],
      peutNoter: false,
      noterAvant: null,
      expireLe: null,
    });
  });

  it('jette une ligne sans identifiant ou sans statut connu', () => {
    expect(envoiDeLApi({ status: 'ACCEPTED' })).toBeNull();
    expect(envoiDeLApi({ id: 'x', status: 'EN_VOL' })).toBeNull();
    expect(envoiDeLApi(null)).toBeNull();
    expect(envoiDeLApi('un envoi')).toBeNull();
  });

  it('un envoi dont on a perdu le Voyageur reste LISIBLE', () => {
    // C'est le colis de quelqu'un, pas une ligne de base. Et le serveur sert
    // un « fantôme » quand le compte a disparu (GHOST_COUNTERPART).
    expect(projete({ carrier: {} }).voyageur).toBe('');
    expect(projete({ carrier: { firstName: 'Inês' } }).voyageur).toBe('Inês');
    expect(projete({ carrier: { lastInitial: 'N' } }).voyageur).toBe('N');
  });

  it('sans trajet, sans prix, sans rien : la carte tient quand même', () => {
    const envoi = projete({ trip: undefined, pricing: undefined, rating: undefined });
    expect(envoi.depart).toBe('');
    expect(envoi.dateDepart).toBeNull();
    expect(envoi.totalCents).toBeNull();
    expect(envoi.devise).toBe('EUR'); // un prix sans devise ne s'écrit pas
    expect(envoi.peutNoter).toBe(false);
  });

  it('sans `allowedActions`, AUCUN geste n’est proposé', () => {
    const envoi = projete({ allowedActions: undefined });
    expect(envoi.actions).toEqual([]);
    expect(actionMiseEnAvant(envoi)).toBeNull();
  });

  it('les gestes inconnus de l’app sont ignorés, pas recopiés', () => {
    // Le serveur peut servir des actions d'un autre rôle ou d'une version
    // ultérieure ; on n'en garde que ce qu'on sait faire.
    expect(projete({ allowedActions: ['cancel', 'pickup', 42, null] }).actions).toEqual(['cancel']);
  });

  it('le décompte n’existe QUE pour une demande en attente', () => {
    // C'est la seule qui meurt toute seule (DEA-01). Afficher une échéance
    // ailleurs ferait croire que tout le reste expire aussi.
    expect(projete({ status: 'PENDING' }).expireLe).toBe('2026-11-20T10:00:00.000Z');
    expect(projete({ status: 'ACCEPTED' }).expireLe).toBeNull();
    expect(projete({ status: 'COMPLETED' }).expireLe).toBeNull();
  });
});

describe('② « À traiter » = ce que le SERVEUR accorde, pas une table de statuts', () => {
  it('confirmer la réception met l’envoi en tête', () => {
    expect(
      sectionDeLEnvoi(projete({ status: 'DELIVERED', allowedActions: ['confirmEarly', 'dispute'] }))
    ).toBe('aTraiter');
  });

  it('une notation ouverte met l’envoi en tête, même s’il est TERMINÉ', () => {
    expect(
      sectionDeLEnvoi(
        projete({ status: 'COMPLETED', allowedActions: [], rating: { canRate: true, ratedByMe: false } })
      )
    ).toBe('aTraiter');
  });

  it('une notation DÉJÀ faite ne réclame plus rien', () => {
    expect(
      sectionDeLEnvoi(
        projete({ status: 'COMPLETED', allowedActions: [], rating: { canRate: true, ratedByMe: true } })
      )
    ).toBe('passes');
  });

  it('un colis EN ROUTE ne réclame rien à l’Expéditeur — et c’est le point', () => {
    // LE DÉSACCORD AVEC LE SITE, ÉCRIT NOIR SUR BLANC.
    // `getShipmentPresentation` y range PICKED_UP sans événement de suivi
    // dans « À traiter », en urgent. Or l'Expéditeur n'a là aucun geste qui
    // fasse avancer l'envoi : `dispute` escalade, il ne fait pas avancer.
    // Celui qui doit agir est le Voyageur — il doit déclarer son passage à
    // l'aéroport. Une tâche posée sur le bureau de quelqu'un qui ne peut
    // rien faire n'est pas un rappel, c'est un reproche.
    expect(
      sectionDeLEnvoi(projete({ status: 'PICKED_UP', allowedActions: ['dispute'] }))
    ).toBe('enCours');
  });

  it('défaire et escalader ne sont PAS des tâches en attente', () => {
    // Sans quoi la liste des envois deviendrait une liste de regrets : tout
    // ce qui est annulable serait « à traiter ».
    expect(sectionDeLEnvoi(projete({ status: 'ACCEPTED', allowedActions: ['cancel'] }))).toBe(
      'enCours'
    );
    expect(sectionDeLEnvoi(projete({ status: 'PENDING', allowedActions: ['cancel'] }))).toBe(
      'enCours'
    );
  });

  it('les quatre fins de parcours tombent dans « Passés »', () => {
    for (const statut of ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED']) {
      expect(sectionDeLEnvoi(projete({ status: statut, allowedActions: [] }))).toBe('passes');
    }
  });

  it('un litige ouvert reste EN COURS : il se passe quelque chose', () => {
    expect(sectionDeLEnvoi(projete({ status: 'DISPUTED', allowedActions: [] }))).toBe('enCours');
  });

  it('`peut` lit la liste du serveur, il ne la devine pas', () => {
    expect(peut(projete({ allowedActions: ['cancel'] }), 'cancel')).toBe(true);
    expect(peut(projete({ allowedActions: [] }), 'cancel')).toBe(false);
  });
});

describe('③ trois sections, aucune vide, un ordre', () => {
  it('il n’y a que trois sections, dans cet ordre', () => {
    expect(SECTIONS).toEqual(['aTraiter', 'enCours', 'passes']);
  });

  it('une section sans envoi DISPARAÎT', () => {
    const groupes = grouperLesEnvois([projete({ status: 'ACCEPTED' })]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].section).toBe('enCours');
  });

  it('l’ordre des sections tient quelles que soient les données', () => {
    const groupes = grouperLesEnvois([
      projete({ id: 'a', status: 'CANCELLED', allowedActions: [] }),
      projete({ id: 'b', status: 'ACCEPTED' }),
      projete({ id: 'c', status: 'DELIVERED', allowedActions: ['confirmEarly'] }),
    ]);
    expect(groupes.map((g) => g.section)).toEqual(['aTraiter', 'enCours', 'passes']);
  });

  it('l’ordre du SERVEUR est conservé dans chaque section', () => {
    // `GET /me/bookings` trie par création décroissante : le dernier colis
    // parti d'abord. On suit un envoi, on ne planifie rien — contrairement
    // aux trajets, triés par date de départ (D111 quinquies).
    const groupes = grouperLesEnvois([
      projete({ id: 'recent', status: 'ACCEPTED' }),
      projete({ id: 'vieux', status: 'ACCEPTED' }),
    ]);
    expect(groupes[0].envois.map((e) => e.id)).toEqual(['recent', 'vieux']);
  });

  it('aucun envoi : aucun groupe (l’écran montre son état vide)', () => {
    expect(grouperLesEnvois([])).toEqual([]);
  });
});

describe('④ une action par carte, et la bonne', () => {
  it('confirmer passe AVANT noter', () => {
    // Tant que la réception n'est pas confirmée, l'argent du Voyageur est
    // bloqué. Noter peut attendre, pas être payé.
    expect(
      actionMiseEnAvant(
        projete({
          status: 'DELIVERED',
          allowedActions: ['confirmEarly'],
          rating: { canRate: true, ratedByMe: false },
        })
      )
    ).toBe('confirmer');
  });

  it('noter quand il ne reste que cela', () => {
    expect(
      actionMiseEnAvant(
        projete({ status: 'COMPLETED', allowedActions: [], rating: { canRate: true, ratedByMe: false } })
      )
    ).toBe('noter');
  });

  it('rien à faire : aucun bouton (la carte entière mène au suivi)', () => {
    expect(actionMiseEnAvant(projete({ status: 'PICKED_UP', allowedActions: ['dispute'] }))).toBeNull();
  });

  it('le compte en tête compte ce qui n’est pas derrière soi', () => {
    const envois = [
      projete({ id: 'a', status: 'DELIVERED', allowedActions: ['confirmEarly'] }),
      projete({ id: 'b', status: 'ACCEPTED' }),
      projete({ id: 'c', status: 'PICKED_UP', allowedActions: [] }),
      projete({ id: 'd', status: 'COMPLETED', allowedActions: [] }),
      projete({ id: 'e', status: 'CANCELLED', allowedActions: [] }),
    ];
    expect(compteEnCours(envois)).toBe(3);
  });
});

describe('⑤ le contrat, dans les DEUX sens', () => {
  // Les fiches lisent la SOURCE : `shipment.api.ts` tire `client.ts` →
  // `base-url.ts` → `expo-constants`, que ce harnais ne sait pas charger
  // (frontière A223).
  const api = readFileSync(join(MOBILE, 'src/lib/api/shipment.api.ts'), 'utf8');

  it('l’app sait ÉMETTRE l’appel de liste', () => {
    // La porte qui manquait. Avant ce lot, `/me/bookings` n'apparaissait
    // nulle part dans le téléphone (D112 0A).
    expect(api).toContain("'/me/bookings'");
  });

  it('l’app sait LIRE les NEUF statuts du serveur', () => {
    // Un statut que la projection ne connaît pas fait disparaître l'envoi
    // de la liste (`envoiDeLApi` rend `null`). Si le serveur en ajoute un,
    // c'est ici que cela doit rougir — pas sur l'écran d'un Expéditeur.
    const unionDuDto = api.slice(
      api.indexOf('export type ShipmentServerStatus'),
      api.indexOf('export type ShipmentTrackingStep')
    );
    expect(unionDuDto.length).toBeGreaterThan(0); // la découpe a bien mordu
    const statutsDuDto = [...unionDuDto.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(statutsDuDto).toHaveLength(9);

    const regle = readFileSync(join(MOBILE, 'src/lib/mes-envois.ts'), 'utf8');
    const listeDeLaRegle = regle.slice(
      regle.indexOf('const STATUTS'),
      regle.indexOf('export type ActionEnvoi')
    );
    for (const statut of statutsDuDto) {
      expect(listeDeLaRegle).toContain(`'${statut}'`);
    }
  });

  it('le badge de l’onglet applique la MÊME règle que l’écran', () => {
    // Un compteur calculé à part finit par dire autre chose que l'écran
    // vers lequel il mène — le défaut mesuré sur le site, où « En cours »
    // affiche deux nombres différents à quarante pixels d'écart.
    //
    // D114 a déplacé ce calcul de `hooks/use-tab-badges.ts` vers le
    // fournisseur `lib/activite-context.tsx`, où il DÉRIVE des mêmes listes
    // que les écrans. La garantie est devenue structurelle ; la fiche reste,
    // parce qu'une structure se défait aussi.
    const source = readFileSync(join(MOBILE, 'src/lib/activite-context.tsx'), 'utf8');
    expect(source).toContain("from '@/lib/mes-envois'");
    expect(source).toContain('sectionDeLEnvoi');
    expect(source).not.toMatch(/status === 'DELIVERED'/);
  });

  it('l’écran n’a AUCUN filtre — et c’est la décision, pas un oubli', () => {
    // Le site pose quatre pastilles au-dessus d'une liste déjà sectionnée
    // par les trois mêmes groupes ; taper « Terminés » y cache les deux
    // groupes qui réclament une action.
    const ecran = readFileSync(join(MOBILE, 'src/app/shipments/mine.tsx'), 'utf8');
    expect(ecran).not.toContain('setFiltre');
    expect(ecran).not.toContain('filters');
    const textes = readFileSync(join(MOBILE, 'messages/fr/myShipments.json'), 'utf8');
    expect(textes).not.toContain('"filters"');
  });

  it('la LISTE ne montre jamais le code de livraison', () => {
    // D43 : servi en PICKED_UP seulement, à l'Expéditeur seul. Une liste se
    // regarde par-dessus l'épaule dans une file d'embarquement.
    const regle = readFileSync(join(MOBILE, 'src/lib/mes-envois.ts'), 'utf8');
    const ecran = readFileSync(join(MOBILE, 'src/app/shipments/mine.tsx'), 'utf8');
    expect(regle).not.toContain('deliveryCode');
    expect(ecran).not.toContain('deliveryCode');
  });

  it('la porte existe : l’onglet Activité mène à l’écran', () => {
    // Tout le lot tient là-dedans. Une destination sans porte est du code
    // mort qui s'ignore — 2 903 lignes, en l'occurrence.
    const onglet = readFileSync(join(MOBILE, 'src/app/(tabs)/activity.tsx'), 'utf8');
    expect(onglet).toContain("'/shipments/mine'");
    const pile = readFileSync(join(MOBILE, 'src/app/_layout.tsx'), 'utf8');
    expect(pile).toContain('name="shipments/mine"');
  });
});
