/**
 * remise.spec.ts — la remise du colis (D116).
 * =============================================
 * Ce que ces fiches tiennent :
 *   ① le SERVEUR compte, l'app lit — et un refus sans chiffre lisible
 *     n'invente rien ;
 *   ② un verrou a un HORIZON, et sa fin est une relecture, pas une
 *     permission ;
 *   ③ ce qui retient l'envoi est une liste ORDONNÉE (le verrou avant le
 *     code : dire « il manque deux chiffres » quand la saisie est bloquée
 *     est exact et hors sujet) ;
 *   ④ les photos sont facultatives mais ne bloquent jamais en silence ;
 *   ⑤ la copie du contrat, et le code qui ne doit JAMAIS apparaître ailleurs.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DELIVERY_PHOTOS_MAX, DeliverDealRequestSchema } from '@packages/api-contracts';

import type { PhotoLocale } from '@/lib/photos';
import {
  CODE_LONGUEUR,
  PHOTOS_REMISE_MAX,
  SAISIE_NEUVE,
  apresLeRefus,
  compteARebours,
  corpsDeLaRemise,
  manquesDeLaRemise,
  resteDuVerrouMs,
  verrouExpire,
  versementDeLaReponse,
  type EtatDeLaSaisie,
} from '@/lib/remise';

const MOBILE = resolve(__dirname, '../..');
const MIDI = Date.parse('2026-11-27T12:00:00.000Z');

function photo(extra: Partial<PhotoLocale> = {}): PhotoLocale {
  return {
    id: 'asset-1',
    uri: 'file:///remise.jpg',
    uploading: false,
    url: 'https://ik.imagekit.io/yamba/remise.jpg',
    errorCode: null,
    ...extra,
  };
}

function formulaire(
  extra: Partial<{
    code: string;
    photos: readonly PhotoLocale[];
    etat: EtatDeLaSaisie;
    maintenantMs: number;
  }> = {}
) {
  return {
    code: '742891',
    photos: [] as readonly PhotoLocale[],
    etat: SAISIE_NEUVE,
    maintenantMs: MIDI,
    ...extra,
  };
}

describe('① le serveur compte, l’app lit', () => {
  it('un refus de code pose le nombre d’essais QU’IL annonce', () => {
    const apres = apresLeRefus(SAISIE_NEUVE, {
      code: 'DELIVERY_CODE_INVALID',
      details: { attemptsLeft: 2 },
    });
    expect(apres).toEqual({ essaisRestants: 2, verrouJusqua: null });
  });

  it('un refus SANS chiffre lisible n’invente aucun compteur', () => {
    // Un compteur inventé est un mensonge affiché à côté d'un code juste.
    const avant: EtatDeLaSaisie = { essaisRestants: 2, verrouJusqua: null };
    expect(apresLeRefus(avant, { code: 'DELIVERY_CODE_INVALID', details: null })).toEqual(avant);
    expect(
      apresLeRefus(avant, { code: 'DELIVERY_CODE_INVALID', details: { attemptsLeft: 'deux' } })
    ).toEqual(avant);
  });

  it('un VERROU pose zéro essai et son horizon', () => {
    const apres = apresLeRefus(SAISIE_NEUVE, {
      code: 'DELIVERY_LOCKED',
      details: { lockedUntil: '2026-11-27T12:15:00.000Z', attemptsLeft: 0 },
    });
    expect(apres).toEqual({ essaisRestants: 0, verrouJusqua: '2026-11-27T12:15:00.000Z' });
  });

  it('un verrou sans horizon lisible garde l’ancien plutôt que d’effacer', () => {
    const avant: EtatDeLaSaisie = { essaisRestants: 0, verrouJusqua: '2026-11-27T12:10:00.000Z' };
    expect(apresLeRefus(avant, { code: 'DELIVERY_LOCKED', details: {} }).verrouJusqua).toBe(
      '2026-11-27T12:10:00.000Z'
    );
  });

  it('un refus d’une AUTRE nature ne touche pas l’état de la saisie', () => {
    // `TRANSITION_NOT_ALLOWED` ou `DELIVERY_CODE_UNAVAILABLE` ne consomment
    // pas d'essai : l'écran les dit, il ne décrémente rien.
    const avant: EtatDeLaSaisie = { essaisRestants: 2, verrouJusqua: null };
    for (const code of ['TRANSITION_NOT_ALLOWED', 'DELIVERY_CODE_UNAVAILABLE', null]) {
      expect(apresLeRefus(avant, { code, details: { attemptsLeft: 0 } })).toEqual(avant);
    }
  });

  it('les essais sont ceux du SERVEUR : rien ici ne les compte', () => {
    // Premier jet de cette fiche : elle épinglait un `ESSAIS_MAX = 3` local
    // puis INTERDISAIT de s'en servir. Une constante dont la seule règle est
    // « ne t'en sers pas » n'a pas à exister — elle a été supprimée, et la
    // fiche vise maintenant les deux endroits qui pourraient la refaire.
    //
    // On DÉPOUILLE les commentaires avant de chercher : le module explique
    // en toutes lettres pourquoi la constante est absente, et viser le MOT
    // plutôt que l'USAGE est le piège payé cinq fois ce mois-ci.
    for (const chemin of ['src/lib/remise.ts', 'src/app/deal/[id]/deliver.tsx']) {
      const net = sansCommentaires(readFileSync(join(MOBILE, chemin), 'utf8'));
      expect(net).not.toMatch(/ESSAIS_MAX|MAX_ESSAIS|ATTEMPTS_MAX/);
      expect(net).not.toMatch(/essaisRestants\s*-\s*\d/);
    }
  });
});

describe('② le verrou a un horizon, et sa fin est une relecture', () => {
  const verrouille: EtatDeLaSaisie = {
    essaisRestants: 0,
    verrouJusqua: '2026-11-27T12:15:00.000Z',
  };

  it('il est actif tant qu’il reste du temps', () => {
    // UNE seule fonction répond, et l'écran en tire ses deux besoins : le
    // compte à rebours (la valeur) et « est-ce verrouillé ? » (`> 0`). Un
    // prédicat `verrouActif` vivait ici à côté, testé et appelé par
    // personne : deux façons de poser la même question.
    expect(resteDuVerrouMs(verrouille, MIDI)).toBe(15 * 60_000);
  });

  it('il ne l’est plus à la seconde où il tombe', () => {
    expect(resteDuVerrouMs(verrouille, Date.parse('2026-11-27T12:15:00.000Z'))).toBe(0);
  });

  it('une date ILLISIBLE ne verrouille pas pour toujours', () => {
    // Toute comparaison avec NaN est fausse : sans la garde, le reste
    // deviendrait NaN et `NaN > 0` laisserait l'écran ouvert — ou pire,
    // selon le sens du test. On choisit : on ne bloque pas.
    expect(resteDuVerrouMs({ essaisRestants: 0, verrouJusqua: 'nawak' }, MIDI)).toBe(0);
  });

  it('le compte à rebours ARRONDIT AU SUPÉRIEUR', () => {
    // Afficher 00:00 pendant la dernière seconde ferait croire que c'est
    // fini alors que le serveur refuse encore.
    expect(compteARebours(1)).toBe('0:01');
    // 59,4 s arrondies au supérieur font 60 s, donc UNE MINUTE — et non
    // « 0:60 », que le premier jet de cette fiche attendait. La fonction
    // avait raison, la fiche avait tort : on corrige la fiche.
    expect(compteARebours(59_400)).toBe('1:00');
    expect(compteARebours(59_000)).toBe('0:59');
    expect(compteARebours(15 * 60_000)).toBe('15:00');
    expect(compteARebours(0)).toBe('0:00');
    expect(compteARebours(-5000)).toBe('0:00');
  });

  it('la fin du verrou REPART D’UN ÉTAT NEUF', () => {
    // Le serveur a déjà remis son compteur à zéro : garder « 0 essai
    // restant » afficherait un blocage qu'il n'applique plus.
    expect(verrouExpire()).toEqual(SAISIE_NEUVE);
  });
});

describe('③ ce qui retient l’envoi, dans l’ordre', () => {
  it('le VERROU passe avant le code', () => {
    const manques = manquesDeLaRemise(
      formulaire({ code: '7428', etat: { essaisRestants: 0, verrouJusqua: '2026-11-27T12:05:00.000Z' } })
    );
    expect(manques[0]).toEqual({ quoi: 'verrou', restantMs: 5 * 60_000 });
  });

  it('un code incomplet dit COMBIEN de chiffres manquent', () => {
    expect(manquesDeLaRemise(formulaire({ code: '742' }))).toEqual([{ quoi: 'code', chiffres: 3 }]);
  });

  it('un code collé avec des espaces est complet', () => {
    // « 742 891 » est ce qu'on lit à voix haute, et ce qu'on colle.
    expect(manquesDeLaRemise(formulaire({ code: '742 891' }))).toEqual([]);
  });

  it('un code complet sans photo ne manque de rien — la photo est facultative', () => {
    expect(manquesDeLaRemise(formulaire())).toEqual([]);
  });
});

describe('④ les photos sont facultatives, jamais silencieuses', () => {
  it('une photo EN VOL retient, et le dit', () => {
    expect(
      manquesDeLaRemise(formulaire({ photos: [photo({ uploading: true, url: null })] }))
    ).toEqual([{ quoi: 'televersement' }]);
  });

  it('une photo en ÉCHEC retient, et le dit AUTREMENT', () => {
    // Le site fusionne les deux dans `isSubmitting || !photosReady` : le
    // bouton affiche « Vérification… » pour toujours, sans dire laquelle des
    // deux choses se passe. Deux manques, deux phrases.
    expect(
      manquesDeLaRemise(formulaire({ photos: [photo({ url: null, errorCode: 'FAILED' })] }))
    ).toEqual([{ quoi: 'echec' }]);
  });

  it('retirer la photo en échec débloque l’envoi', () => {
    expect(manquesDeLaRemise(formulaire({ photos: [] }))).toEqual([]);
  });

  it('le corps ne part qu’avec les URL en ligne', () => {
    const corps = corpsDeLaRemise(
      formulaire({ code: '742 891', photos: [photo(), photo({ id: 'b', url: 'https://ik/b.jpg' })] })
    );
    expect(corps).toEqual({
      code: '742891',
      photoUrls: ['https://ik.imagekit.io/yamba/remise.jpg', 'https://ik/b.jpg'],
    });
  });

  it('rien ne part tant qu’il manque quelque chose', () => {
    expect(corpsDeLaRemise(formulaire({ code: '74' }))).toBeNull();
    expect(
      corpsDeLaRemise(
        formulaire({ etat: { essaisRestants: 0, verrouJusqua: '2026-11-27T12:05:00.000Z' } })
      )
    ).toBeNull();
  });
});

/**
 * Un fichier bien écrit EXPLIQUE ce qu'il a cessé de faire : l'en-tête de
 * l'écran de remise raconte pourquoi `oneTimeCode` n'y est pas. Une fiche
 * qui cherche ce mot y rougit — SEPTIÈME occurrence de ce piège dans ce
 * dépôt ce mois-ci. On dépouille donc les commentaires avant de chercher.
 */
function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Un dépouillement qui vide tout passerait toutes les fiches suivantes.
  expect(net.length).toBeGreaterThan(source.length / 3);
  return net;
}

describe('⑤ le contrat, et ce que l’écran n’affiche pas', () => {
  const ecran = sansCommentaires(
    readFileSync(join(MOBILE, 'src/app/deal/[id]/deliver.tsx'), 'utf8')
  );
  const api = readFileSync(join(MOBILE, 'src/lib/api/my-deals.api.ts'), 'utf8');

  it('deux photos au plus, comme le contrat', () => {
    expect(PHOTOS_REMISE_MAX).toBe(DELIVERY_PHOTOS_MAX);
  });

  it('le corps est accepté par le contrat, tel quel', () => {
    const corps = corpsDeLaRemise(formulaire({ photos: [photo()] }));
    expect(DeliverDealRequestSchema.safeParse(corps).success).toBe(true);
  });

  it('un code de SIX chiffres, et le contrat refuse les autres', () => {
    expect(CODE_LONGUEUR).toBe(6);
    expect(DeliverDealRequestSchema.safeParse({ code: '74289', photoUrls: [] }).success).toBe(
      false
    );
    expect(DeliverDealRequestSchema.safeParse({ code: '742891', photoUrls: [] }).success).toBe(
      true
    );
  });

  it('l’app sait ÉMETTRE la remise et le jalon', () => {
    expect(api).toMatch(/\/deliver`/);
    expect(api).toMatch(/\/events`/);
  });

  it('le champ du code ne propose AUCUN remplissage automatique', () => {
    // Le code est DICTÉ par le destinataire (D43), pas reçu par SMS :
    // `oneTimeCode` proposerait un code reçu pour autre chose, devant
    // quelqu'un qui attend. Une bonne pratique est un pari sur un contexte.
    expect(ecran).toContain('autofill={false}');
    expect(ecran).not.toContain('oneTimeCode');
    expect(ecran).not.toContain('sms-otp');
  });

  it('il lit le DROIT dans `allowedActions`, jamais dans un statut', () => {
    expect(ecran).toContain("peut(demande, 'deliver')");
    expect(ecran).not.toContain("'PICKED_UP'");
  });

  it('l’écran ne recalcule PAS la date du versement', () => {
    // C'est de l'argent : `payoutDueAt` vient du serveur (J+4 aujourd'hui).
    expect(ecran).toContain('versementDeLaReponse');
    expect(ecran).not.toMatch(/4\s*\*\s*24/);
    expect(versementDeLaReponse({ payoutDueAt: '2026-12-01T12:00:00.000Z' })).toBe(
      '2026-12-01T12:00:00.000Z'
    );
  });

  it('une réponse sans date lisible ne fabrique pas une échéance', () => {
    expect(versementDeLaReponse({})).toBeNull();
    expect(versementDeLaReponse({ payoutDueAt: 'nawak' })).toBeNull();
    expect(versementDeLaReponse(null)).toBeNull();
  });

  it('les clés CALCULÉES existent dans les DEUX dictionnaires (leçon D83)', () => {
    for (const locale of ['fr', 'en']) {
      const dict = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/deliver.json`), 'utf8')
      ) as Record<string, Record<string, unknown>>;
      for (const code of ['INVALID_TYPE', 'TOO_LARGE', 'FAILED'])
        expect(dict.uploadErrors[code]).toBeTruthy();
      for (const manque of ['code', 'locked', 'televersement', 'echec'])
        expect(dict.missing[manque]).toBeTruthy();
      const jalons = dict.milestones as { steps: Record<string, string> };
      for (const jalon of ['AT_AIRPORT', 'FLIGHT_DEPARTED', 'FLIGHT_ARRIVED'])
        expect(jalons.steps[jalon]).toBeTruthy();
      // Les DEUX versions de chaque phrase qui nomme quelqu'un : un prénom
      // absent ne doit pas laisser « demande à  » (famille D100).
      for (const paire of [
        ['codeWhy', 'codeWhyNoName'],
        ['wrongCodeNamed', 'wrongCode'],
        ['callNamed', 'call'],
        ['doneBodyWithDate', 'doneBody'],
      ]) {
        for (const cle of paire) expect(dict[cle]).toBeTruthy();
      }
    }
  });
});
