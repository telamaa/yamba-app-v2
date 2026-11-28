/**
 * fil.spec.ts — le fil de discussion (D117).
 * ============================================
 * Ce que ces fiches tiennent :
 *   ① la réponse du serveur est lue ENTIÈREMENT — le défaut que ce lot
 *     corrige, et qui est D102 rejoué sur un autre contrat ;
 *   ② un accès illisible se lit FERMÉ, et une fermeture s'annonce ;
 *   ③ ce qui retient l'envoi est une liste ORDONNÉE, jamais un booléen ;
 *   ④ on avertit l'AUTEUR des coordonnées, et lui seul ;
 *   ⑤ aucun message ne disparaît parce qu'on n'a pas su lire sa date ;
 *   ⑥ la copie du contrat, confrontée au Zod réel ;
 *   ⑦ ce que le lot IGNORE à dessein — nommé, et gardé par une fiche.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  ConversationListResponseSchema,
  MESSAGE_MAX_LENGTH,
  MessageKindSchema,
  PostMessageRequestSchema,
} from '@packages/api-contracts';

import {
  MESSAGE_MAX,
  PREAVIS_DE_FERMETURE_JOURS,
  RYTHME_DES_REPONSES_MS,
  RYTHME_DE_LA_LISTE_MS,
  RYTHME_DU_FIL_MS,
  avertirDesCoordonnees,
  conversationDeLApi,
  conversationsDeLApi,
  conversationsLisibles,
  corpsAEnvoyer,
  cleDuRefus,
  estDeMoi,
  filDeLApi,
  groupesParJour,
  jourDuMessage,
  manquesDuMessage,
  messageDeLApi,
  motifDeFermeture,
  preavisDeFermeture,
  type AccesAuFil,
  type MessageDuFil,
} from '@/lib/fil';

const MOBILE = resolve(__dirname, '../..');
const MIDI = Date.parse('2026-11-27T12:00:00.000Z');

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(net.length).toBeGreaterThan(source.length / 4);
  return net;
}

const OUVERT: AccesAuFil = { peutLire: true, peutEcrire: true, motif: null, fermetureA: null };
const FERME: AccesAuFil = {
  peutLire: true,
  peutEcrire: false,
  motif: 'litige',
  fermetureA: null,
};

function conversationBrute(extra: Record<string, unknown> = {}) {
  return {
    id: '6af02258df22bba0f54c5516',
    bookingId: '6af02258df22bba0f54c5520',
    role: 'CARRIER',
    counterpart: { id: '6af02258df22bba0f54c5599', firstName: 'Aminata', avatarUrl: null },
    corridor: {
      originCity: 'Paris',
      destinationCity: 'Brazzaville',
      departureAt: '2026-12-02T08:00:00.000Z',
    },
    bookingStatus: 'ACCEPTED',
    lastMessage: {
      body: 'À quelle heure au Terminal 2 ?',
      authorRole: 'SHIPPER',
      createdAt: '2026-11-27T10:00:00.000Z',
    },
    unreadCount: 2,
    nextMeetup: null,
    access: { canRead: true, canWrite: true, reason: null, writeClosesAt: null },
    ...extra,
  };
}

function message(extra: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'm1',
    kind: 'TEXT',
    authorRole: 'CARRIER',
    authorId: 'u2',
    body: 'Je serai là à 9 h.',
    photoUrls: [],
    systemKey: null,
    systemData: null,
    flaggedContact: false,
    createdAt: '2026-11-27T09:00:00.000Z',
    ...extra,
  };
}

describe('① la réponse du serveur est lue ENTIÈREMENT (D102 rejoué)', () => {
  it('la liste ET le total arrivent — c’est le défaut que ce lot corrige', () => {
    // Avant ce lot : `apiFetch<{ totalUnread: number }>('/messages/conversations')`.
    // La liste traversait le réseau à chaque rafraîchissement de l'activité
    // et mourait à `JSON.parse`.
    const lu = conversationsDeLApi({ items: [conversationBrute()], totalUnread: 2 });
    expect(lu.items).toHaveLength(1);
    expect(lu.totalNonLus).toBe(2);
    expect(lu.items[0]?.interlocuteur.prenom).toBe('Aminata');
  });

  it('le total reste celui du SERVEUR, jamais recalculé depuis la liste', () => {
    // La liste peut être tronquée un jour ; deux comptes qui se
    // contredisent valent moins qu'un seul. Ici la somme des `unreadCount`
    // vaut 4 et le serveur dit 9 : c'est 9 qui gagne.
    const lu = conversationsDeLApi({
      items: [conversationBrute({ unreadCount: 2 }), conversationBrute({ id: 'c2', unreadCount: 2 })],
      totalUnread: 9,
    });
    expect(lu.totalNonLus).toBe(9);
  });

  it('une réponse absente ou biscornue ne casse rien', () => {
    for (const brut of [null, undefined, 'nawak', 42, {}, { items: 'non' }]) {
      const lu = conversationsDeLApi(brut);
      expect(lu.items).toEqual([]);
      expect(lu.totalNonLus).toBe(0);
    }
  });

  it('une ligne sans identité ne s’affiche pas, les autres survivent', () => {
    // D124 — l'identité d'un fil est son DEAL. Une ligne sans `bookingId` ne
    // mène nulle part ; une ligne sans `id` de conversation, elle, est un fil
    // parfaitement normal qui n'a simplement jamais été ouvert.
    const lu = conversationsDeLApi({
      items: [conversationBrute(), { bookingId: '' }, conversationBrute({ bookingId: 'b3', role: 'ADMIN' })],
      totalUnread: 0,
    });
    expect(lu.items).toHaveLength(1);
  });

  it('D124 — un fil JAMAIS OUVERT (sans id de conversation) reste dans la liste', () => {
    // Le défaut que le lot corrige, vu du client : ce garde refusait toute
    // entrée sans `id`, et aurait silencieusement jeté exactement les fils que
    // le serveur vient de rendre visibles. Un filtre écrit pour une forme de
    // données survit mal au changement de cette forme.
    const lu = conversationsDeLApi({
      items: [conversationBrute({ id: null, lastMessage: null, unreadCount: 0 })],
      totalUnread: 0,
    });
    expect(lu.items).toHaveLength(1);
    expect(lu.items[0].id).toBeNull();
    expect(lu.items[0].bookingId).toBe('6af02258df22bba0f54c5520');
  });

  it('D124 — un fil déjà ouvert garde son identifiant de conversation', () => {
    const lu = conversationDeLApi(conversationBrute());
    expect(lu?.id).toBe('6af02258df22bba0f54c5516');
  });

  it('un compteur négatif ou décimal ne descend pas dans l’écran', () => {
    expect(conversationsDeLApi({ items: [], totalUnread: -3 }).totalNonLus).toBe(0);
    expect(conversationDeLApi(conversationBrute({ unreadCount: 2.7 }))?.nonLus).toBe(2);
  });

  it('un dernier message absent ne fabrique pas une ligne vide', () => {
    expect(conversationDeLApi(conversationBrute({ lastMessage: null }))?.dernierMessage).toBeNull();
    expect(conversationDeLApi(conversationBrute({ lastMessage: {} }))?.dernierMessage).toBeNull();
  });
});

describe('② un accès illisible se lit FERMÉ', () => {
  it('l’ABSENCE ne vaut pas permission', () => {
    // Le pire défaut possible ici : un champ manquant qui ouvrirait la
    // saisie pendant un litige. On exige `true`, on ne tolère pas l'absence.
    const sansAcces = conversationDeLApi(conversationBrute({ access: undefined }));
    expect(sansAcces?.acces.peutEcrire).toBe(false);
    expect(sansAcces?.acces.motif).toBe('autre');
  });

  it('les deux motifs du serveur sont nommés', () => {
    expect(motifDeFermeture('DISPUTE_OPEN')).toBe('litige');
    expect(motifDeFermeture('WRITE_WINDOW_OVER')).toBe('fenetre');
  });

  it('un motif INCONNU ferme quand même, et ne prétend pas ouvrir', () => {
    // Si le serveur ferme pour une raison que l'app ne connaît pas encore,
    // elle dit « c'est fermé » plutôt que de mentir dans l'autre sens.
    expect(motifDeFermeture('WHATEVER_NEW')).toBe('autre');
    expect(motifDeFermeture(null)).toBeNull();
    expect(motifDeFermeture('')).toBeNull();
  });

  it('une saisie OUVERTE ne porte aucun motif', () => {
    expect(conversationDeLApi(conversationBrute())?.acces.motif).toBeNull();
  });

  it('la fermeture s’annonce deux jours avant, pas à la seconde où elle tombe', () => {
    const dans3j = new Date(MIDI + 3 * 86_400_000).toISOString();
    const dans1j = new Date(MIDI + 86_400_000).toISOString();
    expect(preavisDeFermeture(dans3j, MIDI)).toBeNull();
    expect(preavisDeFermeture(dans1j, MIDI)).toBe(1);
    expect(PREAVIS_DE_FERMETURE_JOURS).toBe(2);
  });

  it('une échéance passée, absente ou illisible n’annonce rien', () => {
    expect(preavisDeFermeture(new Date(MIDI - 1000).toISOString(), MIDI)).toBeNull();
    expect(preavisDeFermeture(null, MIDI)).toBeNull();
    expect(preavisDeFermeture('nawak', MIDI)).toBeNull();
  });

  it('seules les conversations LISIBLES descendent à l’écran', () => {
    const lu = conversationsDeLApi({
      items: [
        conversationBrute(),
        conversationBrute({ id: 'c2', access: { canRead: false, canWrite: false, reason: null, writeClosesAt: null } }),
      ],
      totalUnread: 0,
    });
    expect(conversationsLisibles(lu.items)).toHaveLength(1);
  });
});

describe('③ ce qui retient l’envoi est une LISTE ordonnée', () => {
  it('la FERMETURE passe avant tout le reste', () => {
    // « Écris quelque chose » à quelqu'un dont la saisie est close est
    // exact et hors sujet — le défaut du verrou de D116, transposé.
    const manques = manquesDuMessage({ corps: '', acces: FERME, envoiEnCours: false });
    expect(manques[0]).toEqual({ quoi: 'ferme', motif: 'litige' });
  });

  it('un texte vide ou blanc ne part pas', () => {
    for (const corps of ['', '   ', '\n\t']) {
      expect(manquesDuMessage({ corps, acces: OUVERT, envoiEnCours: false })).toEqual([
        { quoi: 'vide' },
      ]);
    }
  });

  it('un texte trop long dit DE COMBIEN il dépasse', () => {
    const manques = manquesDuMessage({
      corps: 'x'.repeat(MESSAGE_MAX + 12),
      acces: OUVERT,
      envoiEnCours: false,
    });
    expect(manques).toEqual([{ quoi: 'trop-long', dePlus: 12 }]);
  });

  it('un envoi en cours retient, et c’est un manque comme un autre', () => {
    expect(manquesDuMessage({ corps: 'Bonjour', acces: OUVERT, envoiEnCours: true })).toEqual([
      { quoi: 'envoi' },
    ]);
  });

  it('rien ne retient un message normal, et le corps part TRIMÉ', () => {
    expect(manquesDuMessage({ corps: 'Bonjour', acces: OUVERT, envoiEnCours: false })).toEqual([]);
    expect(corpsAEnvoyer({ corps: '  Bonjour  ', acces: OUVERT, envoiEnCours: false })).toEqual({
      body: 'Bonjour',
    });
  });

  it('ce qui retient ne part pas', () => {
    expect(corpsAEnvoyer({ corps: 'Bonjour', acces: FERME, envoiEnCours: false })).toBeNull();
  });

  it('le refus du code de livraison est une RÈGLE, pas une panne', () => {
    expect(cleDuRefus('DELIVERY_CODE_IN_MESSAGE')).toBe('codeDeLivraison');
    expect(cleDuRefus('CONVERSATION_READ_ONLY')).toBe('ferme');
    expect(cleDuRefus('WHATEVER')).toBe('echec');
    expect(cleDuRefus(null)).toBe('echec');
  });
});

describe('④ on avertit l’AUTEUR des coordonnées, et lui seul (D117 4A)', () => {
  const miennesSignalees = messageDeLApi(
    message({ authorRole: 'CARRIER', flaggedContact: true })
  ) as MessageDuFil;
  const siennesSignalees = messageDeLApi(
    message({ id: 'm2', authorRole: 'SHIPPER', flaggedContact: true })
  ) as MessageDuFil;

  it('ma bulle signalée m’avertit', () => {
    expect(avertirDesCoordonnees(miennesSignalees, 'CARRIER')).toBe(true);
  });

  it('la bulle de l’AUTRE ne le désigne pas du doigt', () => {
    // La détection est une regex qui ne distingue pas un numéro de vol d'un
    // téléphone. Accuser quelqu'un là-dessus serait pire que se taire.
    expect(avertirDesCoordonnees(siennesSignalees, 'CARRIER')).toBe(false);
  });

  it('un message non signalé n’avertit personne', () => {
    const net = messageDeLApi(message()) as MessageDuFil;
    expect(avertirDesCoordonnees(net, 'CARRIER')).toBe(false);
  });

  it('le drapeau est LU du serveur, jamais recalculé ici', () => {
    // L'app ne refait aucune détection : deux détections divergeraient, et
    // c'est le serveur qui écrit `flaggedContact` en base. On vise l'USAGE
    // (lire un contenu) et pas un mot — le piège payé cinq fois ce mois-ci.
    const net = sansCommentaires(readFileSync(join(MOBILE, 'src/lib/fil.ts'), 'utf8'));
    for (const lecture of ['RegExp(', '.test(', '.match(']) {
      expect(net).not.toContain(lecture);
    }
    // Et un drapeau qui n'est pas un booléen vaut « non signalé » : on ne
    // devine pas une accusation.
    expect(messageDeLApi(message({ flaggedContact: 'oui' }))?.coordonneesDetectees).toBe(false);
  });

  it('la bulle est MIENNE par le rôle du lecteur, pas par un identifiant', () => {
    // `authorId` est nullable au contrat et un message système n'a pas
    // d'auteur : comparer des identifiants casserait sur le premier SYSTEM.
    expect(estDeMoi(miennesSignalees, 'CARRIER')).toBe(true);
    expect(estDeMoi(siennesSignalees, 'CARRIER')).toBe(false);
    const systeme = messageDeLApi(
      message({ id: 'm3', kind: 'SYSTEM', authorRole: 'SYSTEM', authorId: null })
    ) as MessageDuFil;
    expect(estDeMoi(systeme, 'CARRIER')).toBe(false);
  });
});

describe('⑤ aucun message ne disparaît faute de date lisible', () => {
  it('les journées se suivent, dans l’ordre reçu', () => {
    const messages = [
      messageDeLApi(message({ id: 'a', createdAt: '2026-11-26T09:00:00.000Z' })),
      messageDeLApi(message({ id: 'b', createdAt: '2026-11-26T18:00:00.000Z' })),
      messageDeLApi(message({ id: 'c', createdAt: '2026-11-27T08:00:00.000Z' })),
    ].filter((m): m is MessageDuFil => m !== null);
    const groupes = groupesParJour(messages);
    expect(groupes).toHaveLength(2);
    expect(groupes[0]?.messages.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groupes[1]?.messages.map((m) => m.id)).toEqual(['c']);
  });

  it('une date ILLISIBLE rejoint le groupe courant plutôt que de se perdre', () => {
    const messages: MessageDuFil[] = [
      messageDeLApi(message({ id: 'a' })) as MessageDuFil,
      { ...(messageDeLApi(message({ id: 'b' })) as MessageDuFil), creeA: 'nawak' },
    ];
    const groupes = groupesParJour(messages);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('la clé du jour est LOCALE, et ne s’affiche jamais telle quelle', () => {
    // Un message de 23 h 30 appartient à la journée que le lecteur a vécue.
    // La clé sert à GROUPER ; c'est l'écran qui la met dans sa langue (D108).
    expect(jourDuMessage('nawak')).toBeNull();
    const cle = jourDuMessage('2026-11-27T09:00:00.000Z');
    expect(cle).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ecran = readFileSync(join(MOBILE, 'src/app/conversation/[id].tsx'), 'utf8');
    expect(ecran).toMatch(/toLocaleDateString|formatDate|intlDate/);
  });

  it('un message sans identifiant ni date ne descend pas', () => {
    expect(messageDeLApi(message({ id: '' }))).toBeNull();
    expect(messageDeLApi(message({ createdAt: '' }))).toBeNull();
    expect(messageDeLApi(null)).toBeNull();
  });

  it('un genre inconnu s’affiche au CENTRE, pas dans une bulle attribuée', () => {
    expect(messageDeLApi(message({ kind: 'HOLOGRAM' }))?.genre).toBe('SYSTEM');
    expect(messageDeLApi(message({ authorRole: 'ROBOT' }))?.roleAuteur).toBe('SYSTEM');
  });
});

describe('⑥ la copie du contrat, confrontée au Zod réel', () => {
  it('deux mille caractères, et c’est le contrat qui le dit', () => {
    expect(MESSAGE_MAX).toBe(MESSAGE_MAX_LENGTH);
    expect(PostMessageRequestSchema.safeParse({ body: 'x'.repeat(MESSAGE_MAX) }).success).toBe(true);
    expect(PostMessageRequestSchema.safeParse({ body: 'x'.repeat(MESSAGE_MAX + 1) }).success).toBe(
      false
    );
    expect(PostMessageRequestSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('les trois genres de message sont ceux du contrat', () => {
    expect(MessageKindSchema.options).toEqual(['TEXT', 'SYSTEM', 'MEETUP']);
  });

  it('ce que l’app projette est accepté par le schéma de la LISTE', () => {
    // La fiche lit le contrat dans l'autre sens : la réponse qu'on simule
    // ici doit être une réponse que le serveur peut réellement servir.
    expect(
      ConversationListResponseSchema.safeParse({
        items: [conversationBrute()],
        totalUnread: 2,
      }).success
    ).toBe(true);
  });

  it('les rythmes de sondage sont les MÊMES que ceux du site', () => {
    // Lu avec `readFileSync`, jamais importé : un import à travers une
    // frontière de projet est une dépendance de build (D93).
    //
    // On extrait les VALEURS plutôt que de chercher une chaîne : `3_000` et
    // `3000` sont le même rythme, et une fiche qui rougit sur un souligné
    // finit par être désactivée.
    const site = readFileSync(resolve(MOBILE, '../user-ui/src/hooks/useMessaging.ts'), 'utf8');
    // Le rythme du fil vit DERRIÈRE un ternaire
    // (`options?.active === false ? false : 3_000`) : viser ce qui suit
    // immédiatement les deux points ne trouvait qu'un rythme sur deux, et
    // la fiche a rougi pour la bonne raison dès son premier jet.
    const rythmes = [...site.matchAll(/refetchInterval:[^\n]*?([0-9][0-9_]*)/g)].map((m) =>
      Number(m[1].replace(/_/g, ''))
    );
    expect(rythmes.length).toBeGreaterThanOrEqual(2);
    expect(rythmes).toContain(RYTHME_DU_FIL_MS);
    expect(rythmes).toContain(RYTHME_DE_LA_LISTE_MS);
    expect(RYTHME_DES_REPONSES_MS).toBe(60 * 60_000);
  });
});

describe('⑦ ce que le lot lit, et ce qu’il ignore ENCORE à dessein', () => {
  it('le numéro est lu depuis D118 — cette fiche a ROUGI pour le dire', () => {
    // Écrite au lot 1 pour épingler une absence DÉLIBÉRÉE, elle est passée
    // au rouge à la seconde où D118 a importé `phone`. C'est la seule forme
    // de rappel qui survive à l'oubli : on n'a pas eu à s'en souvenir.
    const lu = filDeLApi({
      conversation: conversationBrute(),
      messages: [message()],
      meetups: [{ id: 'r1' }],
      nextCursor: null,
      phone: { revealed: false, phoneE164: null, opensAt: '2026-12-02T06:00:00.000Z' },
    });
    expect(lu?.messages).toHaveLength(1);
    expect(lu?.numero.ouvreA).toBe('2026-12-02T06:00:00.000Z');
    expect(lu?.numero.revele).toBe(false);
  });

  it('`meetups` reste ignoré, et c’est une DÉCISION', () => {
    // Le serveur calcule déjà LEQUEL des rendez-vous compte
    // (`nextMeetupOf`) et le sert dans `conversation.nextMeetup`. Lire la
    // liste entière pour refaire ce choix donnerait deux vérités — et le
    // jour où ANO-WEB-47 se rejoue, l'une des deux serait fausse.
    const lu = filDeLApi({
      conversation: conversationBrute({
        nextMeetup: {
          id: 'r1',
          kind: 'PICKUP',
          status: 'PROPOSED',
          proposedByRole: 'SHIPPER',
          placeLabel: 'Terminal 2E, porte 4',
          placeDetails: null,
          startAt: '2026-12-02T08:00:00.000Z',
          endAt: '2026-12-02T09:00:00.000Z',
        },
      }),
      messages: [],
      meetups: [{ id: 'autre' }, { id: 'encore' }],
      phone: { revealed: false, phoneE164: null, opensAt: null },
    });
    expect(lu?.conversation.prochainRendezVous?.id).toBe('r1');
    const source = readFileSync(join(MOBILE, 'src/lib/fil.ts'), 'utf8');
    expect(source).toContain('`meetups` reste ignoré');
    expect(source).not.toMatch(/corps\.meetups/);
  });

  it('un fil sans conversation lisible ne s’ouvre pas', () => {
    expect(filDeLApi({ conversation: null, messages: [] })).toBeNull();
    expect(filDeLApi(null)).toBeNull();
  });
});
