/**
 * rating-form.spec.ts — la notation d'A222 : quatre visages, un double-aveugle.
 * =============================================================================
 * Même principe que `report-form.spec.ts` : les constantes du contrat sont
 * RECOPIÉES dans le module (zod hors du bundle Metro), donc confrontées ici au
 * contrat réel — y compris le corps de `POST /deals/:id/rating`, que
 * `toRatingPayload` fabrique et que le schéma doit accepter tel quel.
 *
 * Le cœur, c'est `ratingFace` : D53 rend ma note publique seulement quand
 * l'autre a noté aussi. Un seul endroit, quatre vérités différentes — et un
 * écran qui se trompe de visage révèle (ou cache) une note à tort.
 */
import {
  CARRIER_RATING_CRITERIA,
  RATING_COMMENT_MAX_LENGTH as CONTRACT_COMMENT_MAX,
  SubmitRatingRequestSchema,
} from '@packages/api-contracts';

import {
  CARRIER_CRITERIA,
  EMPTY_RATING_FORM,
  RATING_COMMENT_MAX_LENGTH,
  RATING_MAX,
  RATING_MIN,
  canSubmitRating,
  describeComment,
  ratingFace,
  ratingFailureKey,
  toRatingPayload,
  toggleCriterion,
  type RatingFaceInput,
} from '@/lib/rating-form';

import { NOW_MS } from '@/test-support/fixtures';

function aContext(patch: Partial<RatingFaceInput> = {}): RatingFaceInput {
  return {
    canRate: true,
    ratedByMe: false,
    revealedAt: null,
    windowEndsAt: new Date(NOW_MS + 10 * 86_400_000).toISOString(),
    ...patch,
  };
}

describe('les constantes RECOPIÉES disent la même chose que le contrat', () => {
  it('les trois critères du Voyageur, dans le MÊME ordre', () => {
    expect([...CARRIER_CRITERIA]).toEqual([...CARRIER_RATING_CRITERIA]);
  });

  it('le commentaire est plafonné à la même longueur des deux côtés', () => {
    expect(RATING_COMMENT_MAX_LENGTH).toBe(CONTRACT_COMMENT_MAX);
  });

  it('l’échelle 1→5 est celle que le schéma accepte, bornes comprises', () => {
    expect(SubmitRatingRequestSchema.safeParse({ rating: RATING_MIN }).success).toBe(true);
    expect(SubmitRatingRequestSchema.safeParse({ rating: RATING_MAX }).success).toBe(true);
    expect(SubmitRatingRequestSchema.safeParse({ rating: RATING_MIN - 1 }).success).toBe(false);
    expect(SubmitRatingRequestSchema.safeParse({ rating: RATING_MAX + 1 }).success).toBe(false);
  });
});

describe('ratingFace — les quatre visages d’un seul écran (D53)', () => {
  it('le serveur dit oui : c’est le formulaire, et rien d’autre ne compte', () => {
    expect(ratingFace(aContext(), NOW_MS)).toBe('form');
  });

  it('la RÉVÉLATION l’emporte : les deux avis sont publics, on les montre', () => {
    const revealed = aContext({ canRate: false, ratedByMe: true, revealedAt: '2027-03-30T10:00:00.000Z' });
    expect(ratingFace(revealed, NOW_MS)).toBe('revealed');
  });

  it('j’ai noté, l’autre pas : rien n’est public, et on le dit', () => {
    expect(ratingFace(aContext({ canRate: false, ratedByMe: true }), NOW_MS)).toBe('sent');
  });

  it('jamais noté et la fenêtre est passée : c’est fermé — la date SERVIE tranche', () => {
    const closed = aContext({
      canRate: false,
      windowEndsAt: new Date(NOW_MS - 1000).toISOString(),
    });
    expect(ratingFace(closed, NOW_MS)).toBe('closed');
  });

  it('la fenêtre expirée à la seconde près est déjà fermée', () => {
    const closed = aContext({ canRate: false, windowEndsAt: new Date(NOW_MS).toISOString() });
    expect(ratingFace(closed, NOW_MS)).toBe('closed');
  });

  it('un non du serveur sans fenêtre passée ne s’explique PAS : on ne devine pas la raison', () => {
    expect(ratingFace(aContext({ canRate: false, windowEndsAt: null }), NOW_MS)).toBe('unavailable');
  });

  it('une fenêtre encore ouverte avec un non du serveur reste « indisponible », pas « fermée »', () => {
    expect(ratingFace(aContext({ canRate: false }), NOW_MS)).toBe('unavailable');
  });

  it('une révélation prime même sur une fenêtre fermée', () => {
    const both = aContext({
      canRate: false,
      ratedByMe: true,
      revealedAt: '2027-03-30T10:00:00.000Z',
      windowEndsAt: new Date(NOW_MS - 1000).toISOString(),
    });
    expect(ratingFace(both, NOW_MS)).toBe('revealed');
  });
});

describe('canSubmitRating — la note globale est le SEUL champ requis', () => {
  it('un formulaire vierge n’envoie pas', () => {
    expect(canSubmitRating(EMPTY_RATING_FORM)).toBe(false);
  });

  it('une note suffit — ni critère ni commentaire', () => {
    expect(canSubmitRating({ ...EMPTY_RATING_FORM, rating: 4 })).toBe(true);
  });

  it('les cinq notes de l’échelle passent, et rien autour', () => {
    for (let note = RATING_MIN; note <= RATING_MAX; note += 1) {
      expect(canSubmitRating({ ...EMPTY_RATING_FORM, rating: note })).toBe(true);
    }
    expect(canSubmitRating({ ...EMPTY_RATING_FORM, rating: 6 })).toBe(false);
    expect(canSubmitRating({ ...EMPTY_RATING_FORM, rating: -1 })).toBe(false);
  });
});

describe('toggleCriterion — un pouce qu’on repose EFFACE le vote', () => {
  it('poser un pouce l’enregistre', () => {
    expect(toggleCriterion({}, 'PUNCTUALITY', 'UP')).toEqual({ PUNCTUALITY: 'UP' });
  });

  it('reposer le MÊME pouce efface la clé : un critère facultatif redevient vide', () => {
    expect(toggleCriterion({ PUNCTUALITY: 'UP' }, 'PUNCTUALITY', 'UP')).toEqual({});
  });

  it('poser l’AUTRE pouce remplace, il n’ajoute pas', () => {
    expect(toggleCriterion({ PUNCTUALITY: 'UP' }, 'PUNCTUALITY', 'DOWN')).toEqual({
      PUNCTUALITY: 'DOWN',
    });
  });

  it('ne touche jamais aux autres critères, et ne mute pas l’entrée', () => {
    const before = { COMMUNICATION: 'UP' } as const;
    const after = toggleCriterion(before, 'PARCEL_CARE', 'DOWN');
    expect(after).toEqual({ COMMUNICATION: 'UP', PARCEL_CARE: 'DOWN' });
    expect(before).toEqual({ COMMUNICATION: 'UP' });
  });
});

describe('describeComment — le compteur du commentaire', () => {
  it('compte le texte TRIMÉ, comme le contrat', () => {
    expect(describeComment('   bien   ').length).toBe(4);
  });

  it('prévient trente caractères avant la limite — assez tôt pour réécrire', () => {
    expect(describeComment('a'.repeat(RATING_COMMENT_MAX_LENGTH - 30)).nearLimit).toBe(false);
    expect(describeComment('a'.repeat(RATING_COMMENT_MAX_LENGTH - 29)).nearLimit).toBe(true);
  });

  it('porte le maximum avec lui : l’écran n’a pas à le connaître', () => {
    expect(describeComment('').max).toBe(RATING_COMMENT_MAX_LENGTH);
  });
});

describe('toRatingPayload — le corps envoyé est ACCEPTÉ par le contrat', () => {
  it('une note seule : pas de clé vide, pas de commentaire blanc', () => {
    const payload = toRatingPayload({ rating: 5, criteria: {}, comment: '   ' });
    expect(payload).toEqual({ rating: 5 });
    expect(SubmitRatingRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('un dossier complet passe le schéma zod du serveur', () => {
    const payload = toRatingPayload({
      rating: 4,
      criteria: { PUNCTUALITY: 'UP', PARCEL_CARE: 'DOWN' },
      comment: '  Ponctuel et prévenant.  ',
    });
    expect(payload.comment).toBe('Ponctuel et prévenant.');
    expect(payload.criteria).toEqual({ PUNCTUALITY: 'UP', PARCEL_CARE: 'DOWN' });
    expect(SubmitRatingRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('ANO-API-14 — envoyer UN SEUL critère reste valide (`partialRecord`, pas `record`)', () => {
    const payload = toRatingPayload({ rating: 3, criteria: { COMMUNICATION: 'UP' }, comment: '' });
    expect(SubmitRatingRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('un commentaire de 281 caractères serait refusé par le serveur — le compteur est donc un vrai garde-fou', () => {
    const payload = toRatingPayload({
      rating: 3,
      criteria: {},
      comment: 'a'.repeat(RATING_COMMENT_MAX_LENGTH + 1),
    });
    expect(SubmitRatingRequestSchema.safeParse(payload).success).toBe(false);
  });
});

describe('ratingFailureKey — l’app ne devine pas lequel des trois « non » c’est', () => {
  it('déjà noté, fenêtre fermée, deal pas terminé : une seule façon de le dire', () => {
    expect(ratingFailureKey('TRANSITION_NOT_ALLOWED', 409)).toBe('conflict');
  });

  it('ce deal n’est pas le mien, ou n’existe pas : on ne révèle rien de plus', () => {
    expect(ratingFailureKey('NOT_A_PARTY', 403)).toBe('notFound');
    expect(ratingFailureKey('DEAL_NOT_FOUND', 404)).toBe('notFound');
    expect(ratingFailureKey(null, 404)).toBe('notFound');
  });

  it('une validation et une panne restent distinctes', () => {
    expect(ratingFailureKey(null, 400)).toBe('validation');
    expect(ratingFailureKey(null, 503)).toBe('generic');
  });
});
