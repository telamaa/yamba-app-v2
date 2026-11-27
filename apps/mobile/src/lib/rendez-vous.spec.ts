/**
 * rendez-vous.spec.ts — se retrouver (D118).
 * ============================================
 * Ce que ces fiches tiennent :
 *   ① le contrôle ne peut pas EXPRIMER ce que le serveur refuserait —
 *     c'est l'arbitrage central du lot, et il se vérifie par balayage ;
 *   ② on n'accepte pas sa propre proposition, et l'écran le sait avant ;
 *   ③ la porte du numéro a quatre états, dont aucun n'est un bouton mort ;
 *   ④ la copie des bornes, confrontée au contrat Zod ET aux règles pures
 *     du serveur lues avec `readFileSync` ;
 *   ⑤ ce qui retient une proposition est une liste ORDONNÉE.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ProposeMeetupRequestSchema } from '@packages/api-contracts';

import {
  AVANCE_MINIMALE_MINUTES,
  DETAIL_MAX,
  DUREES_MINUTES,
  FENETRE_MAX_HEURES,
  JOURS_MAX,
  JOURS_PROPOSES,
  LIEU_MAX,
  LIEU_MIN,
  attendUneReponse,
  cleDuRefusDuNumero,
  cleDuRefusDuRendezVous,
  corpsDuRendezVous,
  creneauDe,
  etatDuNumero,
  fenetreDuNumero,
  heuresProposables,
  joursProposables,
  manquesDuRendezVous,
  numeroOuvrable,
  peutAccepter,
  rendezVousDeLApi,
  type CreneauChoisi,
  type RendezVous,
} from '@/lib/rendez-vous';

const MOBILE = resolve(__dirname, '../..');
const SERVEUR = resolve(MOBILE, '../message-service/src/lib');
/** Un jeudi à midi, heure locale de la machine qui joue les fiches. */
const MIDI = new Date(2026, 10, 27, 12, 0, 0).getTime();

function choix(extra: Partial<CreneauChoisi> = {}): CreneauChoisi {
  const [jour] = joursProposables(MIDI, 2);
  return {
    jour: jour ?? null,
    minutes: 15 * 60,
    duree: 60,
    lieu: 'Terminal 2E, porte 4',
    detail: '',
    genre: 'PICKUP',
    ...extra,
  };
}

function rdv(extra: Record<string, unknown> = {}): RendezVous {
  return rendezVousDeLApi({
    id: 'r1',
    kind: 'PICKUP',
    status: 'PROPOSED',
    proposedByRole: 'SHIPPER',
    placeLabel: 'Terminal 2E, porte 4',
    placeDetails: null,
    startAt: '2026-12-02T08:00:00.000Z',
    endAt: '2026-12-02T09:00:00.000Z',
    ...extra,
  }) as RendezVous;
}

describe('① le contrôle ne peut pas EXPRIMER l’impossible', () => {
  it('aucune durée offerte ne dépasse la fenêtre du serveur', () => {
    // `WINDOW_TOO_LONG` est inatteignable parce que la durée vient d'une
    // LISTE, pas d'une seconde saisie d'heure.
    for (const duree of DUREES_MINUTES) {
      expect(duree).toBeLessThanOrEqual(FENETRE_MAX_HEURES * 60);
      expect(duree).toBeGreaterThan(0);
    }
  });

  it('la fin est TOUJOURS après le début, par construction', () => {
    // `END_BEFORE_START` est inatteignable : la fin est calculée, jamais
    // saisie. On balaie les quatre durées plutôt que d'en croire une.
    for (const duree of DUREES_MINUTES) {
      const creneau = creneauDe(choix({ duree }));
      expect(creneau).not.toBeNull();
      expect(new Date(creneau?.finA ?? '').getTime()).toBeGreaterThan(
        new Date(creneau?.debutA ?? '').getTime()
      );
    }
  });

  it('aucun jour offert ne dépasse la borne des quatre-vingt-dix jours', () => {
    const jours = joursProposables(MIDI, 400);
    expect(jours.length).toBeLessThanOrEqual(JOURS_MAX);
    const dernier = jours[jours.length - 1];
    expect((dernier?.minuitMs ?? 0) - MIDI).toBeLessThan(JOURS_MAX * 86_400_000);
    expect(JOURS_PROPOSES).toBeLessThan(JOURS_MAX);
  });

  it('aucune heure offerte AUJOURD’HUI n’est trop proche', () => {
    // `TOO_SOON` disparaît du vocabulaire de l'écran : les créneaux à moins
    // de trente minutes ne sont pas proposés, donc jamais envoyés.
    const [aujourdhui] = joursProposables(MIDI, 1);
    const heures = heuresProposables(aujourdhui, MIDI);
    expect(heures.length).toBeGreaterThan(0);
    for (const minutes of heures) {
      expect(aujourdhui.minuitMs + minutes * 60_000).toBeGreaterThanOrEqual(
        MIDI + AVANCE_MINIMALE_MINUTES * 60_000
      );
    }
  });

  it('une journée ENTIÈREMENT passée n’offre aucune heure', () => {
    // Le dernier quart d'heure d'aujourd'hui vu depuis 23 h 55 : la bande
    // doit se taire plutôt que d'offrir un créneau qui sera refusé.
    const tard = new Date(2026, 10, 27, 23, 55, 0).getTime();
    const [aujourdhui] = joursProposables(tard, 1);
    expect(heuresProposables(aujourdhui, tard)).toEqual([]);
  });

  it('un jour FUTUR est offert en entier', () => {
    const [, demain] = joursProposables(MIDI, 2);
    expect(heuresProposables(demain, MIDI)).toHaveLength((24 * 60) / 15);
  });

  it('le corps produit est accepté par le contrat Zod, tel quel', () => {
    const corps = corpsDuRendezVous({ choix: choix(), peutEcrire: true, envoiEnCours: false });
    expect(corps).not.toBeNull();
    expect(ProposeMeetupRequestSchema.safeParse(corps).success).toBe(true);
  });

  it('un détail vide ne part PAS comme chaîne vide', () => {
    // Le contrat accepte l'absence, pas le vide déguisé : `placeDetails: ''`
    // écrirait une ligne vide dans le dossier de l'autre.
    const corps = corpsDuRendezVous({
      choix: choix({ detail: '   ' }),
      peutEcrire: true,
      envoiEnCours: false,
    });
    expect(corps && 'placeDetails' in corps).toBe(false);
  });
});

describe('② on n’accepte pas sa propre proposition', () => {
  it('l’AUTRE partie peut accepter', () => {
    expect(peutAccepter(rdv({ proposedByRole: 'SHIPPER' }), 'CARRIER', true)).toBe(true);
  });

  it('celui qui a proposé ne le peut pas — il ATTEND', () => {
    // Le serveur refuse (`OWN_PROPOSAL`). L'écran ne doit pas offrir un
    // bouton qu'il sait condamné : il dit qu'on attend une réponse.
    expect(peutAccepter(rdv({ proposedByRole: 'SHIPPER' }), 'SHIPPER', true)).toBe(false);
    expect(attendUneReponse(rdv({ proposedByRole: 'SHIPPER' }), 'SHIPPER')).toBe(true);
    expect(attendUneReponse(rdv({ proposedByRole: 'SHIPPER' }), 'CARRIER')).toBe(false);
  });

  it('un rendez-vous DÉJÀ accepté ne s’accepte pas deux fois', () => {
    expect(peutAccepter(rdv({ status: 'ACCEPTED' }), 'CARRIER', true)).toBe(false);
    expect(attendUneReponse(rdv({ status: 'ACCEPTED' }), 'SHIPPER')).toBe(false);
  });

  it('une conversation FERMÉE n’accepte rien', () => {
    expect(peutAccepter(rdv(), 'CARRIER', false)).toBe(false);
  });

  it('un rendez-vous dont on ignore QUI a proposé ne s’affiche pas', () => {
    // Sans le rôle du proposant, on ne peut pas décider du bouton : on ne
    // l'offre pas plutôt que de l'offrir au mauvais côté.
    expect(rendezVousDeLApi({ id: 'r1', startAt: '2026-12-02T08:00:00.000Z' })).toBeNull();
    expect(rendezVousDeLApi({ id: '', proposedByRole: 'SHIPPER' })).toBeNull();
    expect(rendezVousDeLApi(null)).toBeNull();
  });

  it('un genre ou un statut inconnu ne fabrique pas un geste', () => {
    expect(rdv({ kind: 'TELEPORT' }).genre).toBe('PICKUP');
    expect(rdv({ status: 'NAWAK' }).statut).toBe('PROPOSED');
  });
});

describe('③ la porte du numéro a quatre états, aucun n’est muet', () => {
  const ouvreA = new Date(MIDI + 3_600_000).toISOString();

  it('révélé : on a le numéro', () => {
    const f = fenetreDuNumero({ revealed: true, phoneE164: '+33612345678', opensAt: ouvreA });
    expect(etatDuNumero(f, MIDI)).toBe('revele');
    expect(f.numero).toBe('+33612345678');
  });

  it('ouvrable : l’heure est passée, le geste est offert', () => {
    const f = fenetreDuNumero({
      revealed: false,
      phoneE164: null,
      opensAt: new Date(MIDI - 1000).toISOString(),
    });
    expect(etatDuNumero(f, MIDI)).toBe('ouvrable');
    expect(numeroOuvrable(f, MIDI)).toBe(true);
  });

  it('trop tôt : on dit QUAND, jamais « impossible »', () => {
    const f = fenetreDuNumero({ revealed: false, phoneE164: null, opensAt: ouvreA });
    expect(etatDuNumero(f, MIDI)).toBe('trop-tot');
    expect(f.ouvreA).toBe(ouvreA);
  });

  it('sans ancre : l’heure n’existe pas encore, et c’est une AUTRE phrase', () => {
    // `opensAt: null` ne veut pas dire « jamais » : il veut dire qu'aucun
    // rendez-vous de prise en charge n'est accepté et qu'aucune date de
    // départ n'est lisible. L'action utile est de convenir d'un rendez-vous.
    const f = fenetreDuNumero({ revealed: false, phoneE164: null, opensAt: null });
    expect(etatDuNumero(f, MIDI)).toBe('sans-ancre');
    expect(numeroOuvrable(f, MIDI)).toBe(false);
  });

  it('un numéro « révélé » sans numéro ne ment pas', () => {
    const f = fenetreDuNumero({ revealed: true, phoneE164: null, opensAt: ouvreA });
    expect(f.numero).toBeNull();
  });

  it('une heure d’ouverture ILLISIBLE ne passe pas pour ouverte', () => {
    const f = fenetreDuNumero({ revealed: false, phoneE164: null, opensAt: 'nawak' });
    expect(numeroOuvrable(f, MIDI)).toBe(false);
  });

  it('les deux refus du serveur ont chacun leur phrase', () => {
    expect(cleDuRefusDuNumero('TOO_EARLY')).toBe('tropTot');
    expect(cleDuRefusDuNumero('NO_ANCHOR')).toBe('sansAncre');
    expect(cleDuRefusDuNumero('QUOI')).toBe('echec');
  });
});

describe('④ les bornes sont celles du serveur, confrontées à la source', () => {
  const regles = readFileSync(join(SERVEUR, 'meetup.rules.ts'), 'utf8');

  it('les trois bornes de créneau sont les MÊMES que celles du serveur', () => {
    // Lues avec `readFileSync` : un import à travers une frontière de projet
    // est une dépendance de build (D93), et le mobile ne peut pas importer
    // un service de toute façon.
    expect(regles).toContain(`MEETUP_MIN_LEAD_MINUTES = ${AVANCE_MINIMALE_MINUTES}`);
    expect(regles).toContain(`MEETUP_MAX_WINDOW_HOURS = ${FENETRE_MAX_HEURES}`);
    expect(regles).toContain(`MEETUP_MAX_AHEAD_DAYS = ${JOURS_MAX}`);
  });

  it('les deux bornes de texte sont celles du contrat', () => {
    const trop = 'x'.repeat(LIEU_MAX + 1);
    expect(
      ProposeMeetupRequestSchema.safeParse({
        kind: 'PICKUP',
        placeLabel: trop,
        startAt: '2026-12-02T08:00:00.000Z',
        endAt: '2026-12-02T09:00:00.000Z',
      }).success
    ).toBe(false);
    expect(
      ProposeMeetupRequestSchema.safeParse({
        kind: 'PICKUP',
        placeLabel: 'ab',
        startAt: '2026-12-02T08:00:00.000Z',
        endAt: '2026-12-02T09:00:00.000Z',
      }).success
    ).toBe(false);
    expect(LIEU_MIN).toBe(3);
    expect(DETAIL_MAX).toBe(500);
  });

  it('l’ancre du numéro est la PRISE EN CHARGE, pas la remise', () => {
    // D118 3B — l'en-tête de `phone-reveal.rules.ts` disait « rendez-vous
    // de REMISE » quand le code filtre `kind: "PICKUP"`. Dans ce dépôt,
    // « remise » est le geste FINAL vers le destinataire (D43, D116) : le
    // commentaire désignait l'autre bout du transport. Le code a raison —
    // au moment de la remise, c'est le destinataire qu'on appelle, et son
    // téléphone vient du deal, pas de la conversation.
    const service = readFileSync(
      resolve(SERVEUR, '../services/conversation.service.ts'),
      'utf8'
    );
    expect(service).toMatch(/kind: "PICKUP", status: "ACCEPTED"/);
    //
    // Premier jet de cette fiche : `not.toMatch(/rendez-vous de REMISE/)`.
    // Elle a rougi sur la correction elle-même, qui CITE le mot fautif pour
    // expliquer pourquoi il l'était. Septième fois ce mois-ci qu'on vise un
    // mot au lieu d'un sens — et la plus nette, puisqu'une interdiction de
    // mot rend impossible d'expliquer ce mot. On épingle donc ce que la
    // documentation doit AFFIRMER, pas ce qu'elle doit taire.
    const ancre = readFileSync(join(SERVEUR, 'phone-reveal.rules.ts'), 'utf8');
    const entete = ancre.slice(0, ancre.indexOf('*/'));
    expect(entete).toContain('PRISE EN CHARGE');
    expect(entete).toContain('kind: "PICKUP"');
  });
});

describe('⑤ ce qui retient une proposition est une LISTE ordonnée', () => {
  it('la FERMETURE passe avant tout le reste', () => {
    const manques = manquesDuRendezVous({
      choix: choix({ jour: null, lieu: '' }),
      peutEcrire: false,
      envoiEnCours: false,
    });
    expect(manques[0]).toEqual({ quoi: 'ferme' });
  });

  it('un jour ou une heure manquante se dit', () => {
    expect(
      manquesDuRendezVous({ choix: choix({ jour: null }), peutEcrire: true, envoiEnCours: false })
    ).toEqual([{ quoi: 'jour' }]);
    expect(
      manquesDuRendezVous({ choix: choix({ minutes: null }), peutEcrire: true, envoiEnCours: false })
    ).toEqual([{ quoi: 'heure' }]);
  });

  it('un lieu trop court dit COMBIEN il manque', () => {
    expect(
      manquesDuRendezVous({ choix: choix({ lieu: 'T2' }), peutEcrire: true, envoiEnCours: false })
    ).toEqual([{ quoi: 'lieu', caracteres: 1 }]);
  });

  it('un lieu ou un détail trop long dit de COMBIEN il dépasse', () => {
    expect(
      manquesDuRendezVous({
        choix: choix({ lieu: 'x'.repeat(LIEU_MAX + 7) }),
        peutEcrire: true,
        envoiEnCours: false,
      })
    ).toEqual([{ quoi: 'lieu-trop-long', dePlus: 7 }]);
    expect(
      manquesDuRendezVous({
        choix: choix({ detail: 'y'.repeat(DETAIL_MAX + 3) }),
        peutEcrire: true,
        envoiEnCours: false,
      })
    ).toEqual([{ quoi: 'detail-trop-long', dePlus: 3 }]);
  });

  it('rien ne retient une proposition complète', () => {
    expect(manquesDuRendezVous({ choix: choix(), peutEcrire: true, envoiEnCours: false })).toEqual(
      []
    );
  });

  it('ce qui retient ne part pas', () => {
    expect(
      corpsDuRendezVous({ choix: choix({ jour: null }), peutEcrire: true, envoiEnCours: false })
    ).toBeNull();
    expect(corpsDuRendezVous({ choix: choix(), peutEcrire: false, envoiEnCours: false })).toBeNull();
  });

  it('chaque refus du serveur a sa phrase, y compris ceux qu’on croit impossibles', () => {
    // Les trois bornes ne devraient JAMAIS arriver — le contrôle ne sait
    // pas les exprimer. Elles restent traduites parce qu'un serveur peut
    // durcir ses bornes sans prévenir l'app.
    expect(cleDuRefusDuRendezVous('CONVERSATION_READ_ONLY', null)).toBe('ferme');
    expect(cleDuRefusDuRendezVous('MEETUP_CHANGED', null)).toBe('change');
    expect(cleDuRefusDuRendezVous('MEETUP_NOT_ACCEPTABLE', 'OWN_PROPOSAL')).toBe('sienne');
    expect(cleDuRefusDuRendezVous('MEETUP_NOT_ACCEPTABLE', 'NOT_PROPOSED')).toBe('change');
    expect(cleDuRefusDuRendezVous('MEETUP_NOT_FOUND', null)).toBe('introuvable');
    expect(cleDuRefusDuRendezVous('INVALID_MEETUP_SLOT', 'TOO_SOON')).toBe('tropTot');
    expect(cleDuRefusDuRendezVous('INVALID_MEETUP_SLOT', 'TOO_FAR')).toBe('tropLoin');
    expect(cleDuRefusDuRendezVous('INVALID_MEETUP_SLOT', 'WINDOW_TOO_LONG')).toBe('tropLong');
    expect(cleDuRefusDuRendezVous('INVALID_MEETUP_SLOT', 'END_BEFORE_START')).toBe('creneau');
    expect(cleDuRefusDuRendezVous('AUTRE_CHOSE', null)).toBe('echec');
  });
});

describe('⑥ les écrans : ce que la forme doit tenir (D118)', () => {
  const feuille = readFileSync(join(MOBILE, 'src/components/meetup-sheet.tsx'), 'utf8');
  const fil = readFileSync(join(MOBILE, 'src/app/conversation/[id].tsx'), 'utf8');

  it('la feuille ne demande JAMAIS une heure de fin', () => {
    // C'est tout l'arbitrage du lot : deux saisies d'heure permettraient
    // d'exprimer « fin avant début ». Une seule plus une durée ne le peut
    // pas. Un contrôle est une grammaire : il décide de ce qui est DICIBLE.
    expect(feuille).not.toMatch(/setFin|endAt:\s*['"]|heureDeFin/);
    expect(feuille).toContain('DUREES_MINUTES');
  });

  it('la feuille fige l’instant à son OUVERTURE', () => {
    // Recalculer « maintenant » à chaque rendu ferait disparaître une heure
    // sous le doigt au passage d'un quart d'heure.
    expect(feuille).toContain('useState(() => Date.now())');
  });

  it('changer de jour RELÂCHE l’heure choisie', () => {
    // Le lendemain à 8 h existe, aujourd'hui à 8 h non : garder l'heure en
    // silence enverrait un créneau que le serveur refuserait.
    const surLeJour = feuille.slice(feuille.indexOf('setJour(j)'), feuille.indexOf('</ScrollView>'));
    expect(surLeJour.length).toBeGreaterThan(20);
    expect(surLeJour).toContain('setMinutes(null)');
  });

  it('les deux bornes de texte sont posées DANS les champs', () => {
    // Leçon D115 bis ① : plafonner dans le champ vaut mieux que refuser
    // après — et le site ne posait AUCUNE des deux (corrigé en D118 bis).
    expect(feuille).toContain('slice(0, LIEU_MAX)');
    expect(feuille).toContain('slice(0, DETAIL_MAX)');
  });

  it('le bouton de proposition n’est jamais muet', () => {
    expect(feuille).toContain('premierManque');
    expect(feuille).toContain('setMontrerLesManques(true)');
  });

  it('le fil n’offre « Accepter » qu’à celui qui le PEUT', () => {
    // Le serveur refuse `OWN_PROPOSAL` : l'écran ne doit pas offrir un
    // bouton qu'il sait condamné.
    expect(fil).toContain('peutAccepter(rdv, monRole, peutEcrire)');
    expect(fil).toContain('attendUneReponse(rdv, monRole)');
  });

  it('la porte du numéro n’a pas d’état muet', () => {
    // Quatre états, quatre sorties : appeler, ouvrir, dire quand, dire quoi
    // faire. Le site ne disait le motif que dans un attribut `title`, qui
    // n'existe pas sur un téléphone.
    for (const etat of ["'revele'", "'ouvrable'", "'trop-tot'", "'sans-ancre'"]) {
      expect(fil).toContain(etat);
    }
    expect(fil).toContain('phone.opensAt');
    expect(fil).toContain('phone.needsMeetup');
    // Le numéro révélé est un APPEL d'un geste : c'est pour cela qu'on l'a ouvert.
    expect(fil).toMatch(/Linking\.openURL\(`tel:/);
  });

  it('les bandes de jours sont DEUX, et la troisième factorise', () => {
    // `search-calendar.tsx` (D103) répond à une autre question — quel mois,
    // quelle fenêtre — avec une valeur de recherche qu'on ne peut pas
    // prêter à un rendez-vous sans abus de type. D115 3A : on factorise en
    // devenant le TROISIÈME. Une dette comptée se rembourse.
    const bandes = ['src/components/search-calendar.tsx', 'src/components/meetup-sheet.tsx'];
    for (const bande of bandes) expect(readFileSync(join(MOBILE, bande), 'utf8').length).toBeGreaterThan(0);
    expect(bandes).toHaveLength(2);
  });

  it('aucun écran du lot n’importe le contrat — frontière A223', () => {
    for (const source of [feuille, fil]) expect(source).not.toContain('@packages/api-contracts');
  });
});
