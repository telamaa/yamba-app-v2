/**
 * boite.spec.ts — la boîte aux lettres (D119).
 * ==============================================
 * Ce que ces fiches tiennent :
 *   ① l'union FERMÉE du contrat est couverte EN ENTIER, sur les deux
 *     fronts et dans les deux langues — c'est le défaut que le lot a
 *     trouvé en COMPTANT avant d'écrire ;
 *   ② une notification illisible ne tue pas la liste (leçon ANO-API-16) ;
 *   ③ une ligne mène quelque part, ou elle ne prétend pas être cliquable ;
 *   ④ l'âge rend une unité et un NOMBRE, jamais une phrase (D108) ;
 *   ⑤ les écrans : ouvrir ne marque rien, et la cloche est partout.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BookingEventTypeSchema,
  MessagingEventTypeSchema,
  SYSTEM_NOTIFICATION_TYPES,
} from '@packages/api-contracts';

import {
  ancienneteDe,
  boiteDeLApi,
  cleDuLibelle,
  destinationDe,
  estLue,
  notificationDeLApi,
  resteAMarquer,
  roleDuLecteur,
  type NotificationDeLaBoite,
} from '@/lib/boite';

const MOBILE = resolve(__dirname, '../..');
const SITE = resolve(MOBILE, '../user-ui');
const MOI = '6af02258df22bba0f54c5516';
const AUTRE = '6af02258df22bba0f54c5599';
const MIDI = Date.parse('2026-11-27T12:00:00.000Z');

/** Les VINGT-CINQ clés de l'union fermée, lues du contrat Zod. */
const TYPES: string[] = [
  ...BookingEventTypeSchema.options,
  ...SYSTEM_NOTIFICATION_TYPES,
  ...MessagingEventTypeSchema.options,
];

function dico(locale: string, app = MOBILE): Record<string, Record<string, string>> {
  return JSON.parse(
    readFileSync(join(app, `messages/${locale}/notifications.json`), 'utf8')
  ) as Record<string, Record<string, string>>;
}

function brute(extra: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    type: 'booking.accepted',
    bookingId: '6af02258df22bba0f54c5520',
    payload: {
      carrierId: MOI,
      shipperId: AUTRE,
      corridor: { originCity: 'Paris', destinationCity: 'Brazzaville' },
    },
    counterpartFirstName: 'Aminata',
    readAt: null,
    createdAt: '2026-11-27T11:00:00.000Z',
    ...extra,
  };
}

describe('① l’union FERMÉE est couverte EN ENTIER', () => {
  it('le contrat porte bien vingt-cinq clés', () => {
    // Si ce nombre bouge, c'est que le produit a un événement de plus — et
    // les fiches suivantes diront lequel n'a pas de nom.
    expect(TYPES.length).toBe(25);
    expect(new Set(TYPES).size).toBe(25);
  });

  it('CHAQUE type a son libellé dans les DEUX langues du mobile', () => {
    // Le défaut trouvé en comptant AVANT d'écrire : neuf types n'avaient
    // aucun libellé côté site, dont les quatre `conversation.*` que D117 et
    // D118 viennent de rendre quotidiens. Le repli existe pour l'événement
    // de DEMAIN, jamais pour ceux d'hier.
    for (const locale of ['fr', 'en']) {
      const items = dico(locale).items;
      const muets = TYPES.filter((type) => typeof items[cleDuLibelle(type)] !== 'string');
      expect(`${locale} → ${muets.join(', ') || 'aucun'}`).toBe(`${locale} → aucun`);
    }
  });

  it('le SITE garde la même exigence, dans SON harnais', () => {
    // Premier jet de cette fiche : elle mesurait la table `items` du site —
    // qui n'est que le REPLI. Les vraies portes du site sont sa table de
    // présentation et ses phrases par rôle, et elles se gardent là-bas
    // (`apps/user-ui/src/lib/notifications/couverture.spec.ts`), où le
    // harnais peut lire ses propres fichiers. **Mesurer la mauvaise table,
    // c'est compter juste la mauvaise chose** : le défaut annoncé à neuf
    // types n'en touchait que quatre.
    const garde = readFileSync(
      resolve(SITE, 'src/lib/notifications/couverture.spec.ts'),
      'utf8'
    );
    expect(garde).toContain('typesPresentes');
    expect(garde).toContain('BookingEventTypeSchema');
  });

  it('le REPLI existe quand même, et il n’est pas vide', () => {
    // Un client ne doit jamais rester muet sur un type que le serveur a
    // déployé avant lui : c'est un filet, pas une traduction.
    for (const locale of ['fr', 'en']) {
      expect(typeof dico(locale).fallback).toBe('string');
      expect((dico(locale).fallback as unknown as string).length).toBeGreaterThan(3);
    }
  });

  it('aucune clé de libellé ne porte de POINT', () => {
    // Piège maison #174 : `use-intl` refuse une clé contenant un point, et
    // le namespace entier est refusé AU RENDU.
    for (const type of TYPES) expect(cleDuLibelle(type)).not.toContain('.');
    expect(cleDuLibelle('booking.requested')).toBe('booking_requested');
    expect(cleDuLibelle('  conversation.message_posted ')).toBe('conversation_message_posted');
  });

  it('les trois unités d’âge sont des GABARITS pluriels', () => {
    for (const locale of ['fr', 'en']) {
      for (const unite of ['minute', 'heure', 'jour']) {
        expect(dico(locale).age[unite]).toContain('plural');
      }
    }
  });
});

describe('② une notification illisible ne tue pas la liste', () => {
  it('la liste et le compte arrivent', () => {
    const lu = boiteDeLApi({ notifications: [brute()], unreadCount: 3 }, MOI);
    expect(lu.items).toHaveLength(1);
    expect(lu.nonLues).toBe(3);
  });

  it('le compte reste celui du SERVEUR, jamais recalculé', () => {
    // La liste est tronquée aux plus récentes : la recompter donnerait un
    // second chiffre, plus petit et faux.
    const lu = boiteDeLApi(
      { notifications: [brute(), brute({ id: 'n2' })], unreadCount: 12 },
      MOI
    );
    expect(lu.nonLues).toBe(12);
  });

  it('une ligne sans identité, sans TYPE ou sans date est ignorée — les autres survivent', () => {
    // Leçon ANO-API-16, qui fut BLOQUANTE : une notification illisible ne
    // doit jamais être fatale à la boîte entière.
    const lu = boiteDeLApi(
      {
        notifications: [brute(), { id: '' }, brute({ id: 'n3', type: '' }), { id: 'n4' }],
        unreadCount: 0,
      },
      MOI
    );
    expect(lu.items).toHaveLength(1);
  });

  it('une réponse biscornue ne casse rien', () => {
    for (const corps of [null, undefined, 'nawak', 42, {}, { notifications: 'non' }]) {
      const lu = boiteDeLApi(corps, MOI);
      expect(lu.items).toEqual([]);
      expect(lu.nonLues).toBe(0);
    }
  });

  it('une charge utile sans corridor reste parfaitement affichable', () => {
    // Elle n'est pas typée par le contrat (`record(string, unknown)`) :
    // tout y est optionnel, et la notification a un titre de toute façon.
    expect(notificationDeLApi(brute({ payload: {} }), MOI)?.corridor).toBeNull();
    expect(notificationDeLApi(brute({ payload: { corridor: {} } }), MOI)?.corridor).toBeNull();
    expect(notificationDeLApi(brute(), MOI)?.corridor).toBe('Paris → Brazzaville');
  });

  it('un prénom absent ne devient pas une chaîne vide', () => {
    expect(notificationDeLApi(brute({ counterpartFirstName: null }), MOI)?.prenomDeLAutre).toBeNull();
    expect(notificationDeLApi(brute({ counterpartFirstName: '  ' }), MOI)?.prenomDeLAutre).toBeNull();
  });

  it('la date de lecture vient du serveur, jamais fabriquée', () => {
    expect(estLue(notificationDeLApi(brute(), MOI) as NotificationDeLaBoite)).toBe(false);
    expect(
      estLue(notificationDeLApi(brute({ readAt: '2026-11-27T11:30:00.000Z' }), MOI) as NotificationDeLaBoite)
    ).toBe(true);
  });
});

describe('③ une ligne mène quelque part, ou ne prétend pas', () => {
  it('le Voyageur va vers sa DEMANDE', () => {
    const n = notificationDeLApi(brute(), MOI) as NotificationDeLaBoite;
    expect(n.roleDuLecteur).toBe('CARRIER');
    expect(destinationDe(n)).toEqual({ ou: 'demande', id: '6af02258df22bba0f54c5520' });
  });

  it('l’Expéditeur va vers son ENVOI', () => {
    const n = notificationDeLApi(
      brute({ payload: { carrierId: AUTRE, shipperId: MOI } }),
      MOI
    ) as NotificationDeLaBoite;
    expect(n.roleDuLecteur).toBe('SHIPPER');
    expect(destinationDe(n).ou).toBe('envoi');
  });

  it('une notification SYSTÈME ne prétend pas être cliquable', () => {
    const n = notificationDeLApi(
      brute({ type: 'carrier.payout_failed', bookingId: null, payload: {} }),
      MOI
    ) as NotificationDeLaBoite;
    expect(destinationDe(n)).toEqual({ ou: 'nulle-part' });
  });

  it('sans rôle lisible, on ne devine pas une destination', () => {
    // Un geste qui mène nulle part est pire qu'une ligne inerte.
    const n = notificationDeLApi(brute({ payload: {} }), MOI) as NotificationDeLaBoite;
    expect(n.roleDuLecteur).toBeNull();
    expect(destinationDe(n)).toEqual({ ou: 'nulle-part' });
    expect(roleDuLecteur({ carrierId: MOI }, null)).toBeNull();
    expect(roleDuLecteur({ carrierId: MOI }, '')).toBeNull();
    expect(roleDuLecteur({}, MOI)).toBeNull();
  });
});

describe('④ l’âge est une unité et un NOMBRE, jamais une phrase', () => {
  it('les trois paliers', () => {
    expect(ancienneteDe(new Date(MIDI - 30_000).toISOString(), MIDI)).toEqual({
      unite: 'minute',
      valeur: 0,
    });
    expect(ancienneteDe(new Date(MIDI - 5 * 60_000).toISOString(), MIDI)).toEqual({
      unite: 'minute',
      valeur: 5,
    });
    expect(ancienneteDe(new Date(MIDI - 3 * 3_600_000).toISOString(), MIDI)).toEqual({
      unite: 'heure',
      valeur: 3,
    });
    expect(ancienneteDe(new Date(MIDI - 2 * 86_400_000).toISOString(), MIDI)).toEqual({
      unite: 'jour',
      valeur: 2,
    });
  });

  it('une date ILLISIBLE ou FUTURE donne « à l’instant », pas un trou', () => {
    // Une horloge d'appareil en avance de deux minutes est banale ; une
    // ligne sans âge serait plus déroutante qu'une ligne toute fraîche.
    expect(ancienneteDe('nawak', MIDI)).toEqual({ unite: 'minute', valeur: 0 });
    expect(ancienneteDe(new Date(MIDI + 120_000).toISOString(), MIDI)).toEqual({
      unite: 'minute',
      valeur: 0,
    });
  });

  it('le module n’écrit AUCUNE phrase : la langue vit dans le dictionnaire', () => {
    // D108 — un nombre affiché s'écrit dans la langue de celui qui le lit.
    //
    // Premier jet : la recherche portait sur la source ENTIÈRE et a rougi
    // sur le commentaire du module, qui cite « il y a 3 h » pour expliquer
    // que c'est le dictionnaire qui l'écrit. HUITIÈME fois ce mois-ci qu'un
    // mot est visé là où il faut viser un usage — on dépouille.
    const net = readFileSync(join(MOBILE, 'src/lib/boite.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(net.length).toBeGreaterThan(800);
    expect(net).not.toMatch(/il y a |min ago|ago'/);
  });
});

describe('⑤ les écrans : ouvrir ne marque rien, la cloche est partout', () => {
  const ecran = readFileSync(join(MOBILE, 'src/app/notifications.tsx'), 'utf8');

  it('OUVRIR la boîte ne marque RIEN comme lu (D119 4A)', () => {
    // Contrairement au fil — où ouvrir une conversation EST la lire — une
    // liste parcourue des yeux n'a pas été lue. Vider la pastille à
    // l'ouverture ferait perdre ce qu'on n'a pas eu le temps de voir.
    //
    // Premier jet : le découpage partait de `indexOf('useFocusEffect')`,
    // qui trouve l'IMPORT — la tranche couvrait donc tous les imports, dont
    // celui de `marquerToutLu`. Un découpage trop LARGE est le cousin du
    // découpage vide de D98 : il ne rougit pas pour rien, il rougit pour
    // autre chose. On vise l'APPEL.
    const auFocus = ecran.slice(ecran.indexOf('useFocusEffect('), ecran.indexOf('const ouvrir'));
    expect(auFocus.length).toBeGreaterThan(40);
    expect(auFocus.length).toBeLessThan(400);
    expect(auFocus).not.toContain('marquer');
  });

  it('on marque en TOUCHANT une ligne, et avec un bouton explicite', () => {
    expect(ecran).toContain('marquerUneLue(notification.id)');
    expect(ecran).toContain('marquerToutLu()');
  });

  it('« tout marquer lu » n’apparaît que s’il reste à marquer', () => {
    expect(ecran).toContain('resteAMarquer(notifications)');
    expect(resteAMarquer([])).toBe(false);
    const lue = notificationDeLApi(brute({ readAt: '2026-11-27T11:30:00.000Z' }), MOI);
    expect(resteAMarquer([lue as NotificationDeLaBoite])).toBe(false);
    expect(resteAMarquer([notificationDeLApi(brute(), MOI) as NotificationDeLaBoite])).toBe(true);
  });

  it('la liste vient du CONTEXTE : la cloche compte ce que l’écran montre', () => {
    // Doctrine D114 — une lecture, une vérité. Deux lectures à deux
    // instants peuvent se contredire, et la pastille annoncerait alors
    // autre chose que l'écran vers lequel elle mène.
    expect(ecran).toContain('useActivite()');
    expect(ecran).not.toContain('mesNotifications(');
  });

  it('la cloche est sur les QUATRE destinations, par un seul composant', () => {
    // Leçon D105 : une incohérence de charte ne se lit pas, elle se COMPTE.
    // Quatre copies d'une rangée d'en-tête divergent toujours.
    for (const onglet of ['index', 'activity', 'favorites', 'messages']) {
      const source = readFileSync(join(MOBILE, `src/app/(tabs)/${onglet}.tsx`), 'utf8');
      expect(`${onglet} → ${source.includes('<HeaderActions />')}`).toBe(`${onglet} → true`);
      expect(source).not.toContain('<ProfileAvatarButton />');
    }
  });

  it('une absence et une PANNE ne se disent pas pareil', () => {
    expect(ecran).toContain('notificationsEnEchec');
    expect(ecran).toContain("t('loadError')");
    expect(ecran).toContain("t('empty')");
  });
});
