/**
 * rating-form.ts — les règles de la notation, en fonctions PURES.
 * ================================================================
 * La notation est double-aveugle (D53) : ma note part, elle n'est révélée
 * que quand l'autre a noté aussi — ou à la fin des quatorze jours. L'écran
 * a donc QUATRE visages pour un seul endroit, et c'est ce choix-là qui vit
 * ici : il se lit (et s'exécutera) sans React ni réseau.
 *
 * Les constantes miroitent `booking-rating.schema.ts` sans l'importer (zod
 * resterait dans le bundle Metro). Le serveur reste seul juge : `canRate`
 * est SON verdict, jamais une déduction de l'app (RG-MOB-1).
 */

/* ── Le contrat, en miroir ──────────────────────────────────────────────── */

export const RATING_COMMENT_MAX_LENGTH = 280;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/**
 * Les trois critères du rôle VOYAGEUR, dans l'ordre d'affichage du site.
 * Le contrat en porte trois autres pour le rôle Expéditeur
 * (`SHIPPER_RATING_CRITERIA`) : ils arriveront avec le mode Voyageur de
 * l'app, avec leurs textes. Les déclarer ici sans écran ni traduction
 * ferait une liste que rien ne sait afficher.
 */
export const CARRIER_CRITERIA = ['PUNCTUALITY', 'COMMUNICATION', 'PARCEL_CARE'] as const;
export type RatingCriterion = (typeof CARRIER_CRITERIA)[number];
export type CriterionVote = 'UP' | 'DOWN';

/* ── Les quatre visages de l'écran ──────────────────────────────────────── */

/**
 * `form`        — je peux noter (verdict serveur) ;
 * `sent`        — j'ai noté, l'autre pas encore : rien n'est public ;
 * `revealed`    — les deux avis sont publics, on les montre ;
 * `closed`      — les quatorze jours sont passés sans que je note ;
 * `unavailable` — le serveur dit non pour une autre raison (deal clos par
 *                 médiation, pas encore terminé) : on le dit sans inventer
 *                 laquelle.
 */
export type RatingFace = 'form' | 'sent' | 'revealed' | 'closed' | 'unavailable';

export type RatingFaceInput = {
  canRate: boolean;
  ratedByMe: boolean;
  revealedAt: string | null;
  windowEndsAt: string | null;
};

export function ratingFace(input: RatingFaceInput, nowMs: number): RatingFace {
  if (input.canRate) return 'form';
  if (input.revealedAt !== null) return 'revealed';
  if (input.ratedByMe) return 'sent';
  // Jamais noté et plus le droit : la fenêtre est passée, ou le deal n'a
  // jamais été notable. La date SERVIE tranche — pas une supposition.
  if (input.windowEndsAt !== null && Date.parse(input.windowEndsAt) <= nowMs) return 'closed';
  return 'unavailable';
}

/* ── Le formulaire ──────────────────────────────────────────────────────── */

export type RatingForm = {
  /** 0 = pas encore choisi. Le seul champ REQUIS du contrat. */
  rating: number;
  criteria: Partial<Record<RatingCriterion, CriterionVote>>;
  comment: string;
};

export const EMPTY_RATING_FORM: RatingForm = { rating: 0, criteria: {}, comment: '' };

export function canSubmitRating(form: RatingForm): boolean {
  return form.rating >= RATING_MIN && form.rating <= RATING_MAX;
}

export type CommentState = { length: number; max: number; nearLimit: boolean };

export function describeComment(text: string): CommentState {
  const length = text.trim().length;
  return {
    length,
    max: RATING_COMMENT_MAX_LENGTH,
    // Les trente derniers caractères : assez tôt pour réécrire une phrase.
    nearLimit: length > RATING_COMMENT_MAX_LENGTH - 30,
  };
}

/**
 * Un pouce qu'on repose EFFACE le vote : sur un téléphone, il n'y a pas de
 * clic droit pour se dédire, et un critère facultatif doit pouvoir
 * redevenir vide (le serveur ne garde que ce qu'on envoie).
 */
export function toggleCriterion(
  criteria: Partial<Record<RatingCriterion, CriterionVote>>,
  criterion: RatingCriterion,
  vote: CriterionVote
): Partial<Record<RatingCriterion, CriterionVote>> {
  const next = { ...criteria };
  if (next[criterion] === vote) delete next[criterion];
  else next[criterion] = vote;
  return next;
}

/** Le corps de `POST /deals/:id/rating` : pas de clé vide, pas de commentaire blanc. */
export function toRatingPayload(form: RatingForm): {
  rating: number;
  criteria?: Partial<Record<RatingCriterion, CriterionVote>>;
  comment?: string;
} {
  const comment = form.comment.trim();
  return {
    rating: form.rating,
    ...(Object.keys(form.criteria).length > 0 ? { criteria: form.criteria } : {}),
    ...(comment ? { comment } : {}),
  };
}

/* ── Les refus du serveur ───────────────────────────────────────────────── */

/**
 * `TRANSITION_NOT_ALLOWED` couvre les trois « non » du service : déjà noté,
 * fenêtre fermée, deal pas terminé. Ils se racontent d'une seule façon —
 * « ce Deal ne peut plus être noté » — parce que l'app ne sait pas lequel
 * des trois c'est, et que le deviner serait mentir.
 */
export function ratingFailureKey(code: string | null, status: number): string {
  if (code === 'TRANSITION_NOT_ALLOWED') return 'conflict';
  if (code === 'NOT_A_PARTY' || code === 'DEAL_NOT_FOUND' || status === 404) return 'notFound';
  if (status === 400) return 'validation';
  return 'generic';
}
