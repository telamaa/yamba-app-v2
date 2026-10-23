/**
 * rating.api.ts — la notation mutuelle d'un envoi terminé (B5, D53).
 * ==================================================================
 * MÊMES endpoints que le site : `GET /deals/:id/rating` sert tout ce dont
 * l'écran a besoin, `POST /deals/:id/rating` publie la note. Une fois, par
 * rôle, dans les quatorze jours.
 *
 * DOUBLE-AVEUGLE : ma note part, mais rien n'est public avant que l'autre
 * ait noté — ou avant la fin de la fenêtre. Le serveur ne sert la note de
 * l'autre QU'APRÈS révélation (`counterpartRating` reste `null` sinon) :
 * l'app n'a donc rien à cacher elle-même, et c'est voulu — une vérité qu'un
 * client doit protéger est déjà fuitée.
 *
 * Le `canRate` servi est le VERDICT (deal terminé, fenêtre ouverte, pas
 * encore noté par ce rôle) ; l'app le reflète et ne le recalcule jamais
 * (RG-MOB-1). `cannotRateReason` est une phrase ANGLAISE destinée aux
 * journaux : elle ne s'affiche pas — l'écran a ses propres textes.
 */
import type { CriterionVote, RatingCriterion } from '@/lib/rating-form';

import { apiFetch } from './client';

export type RatingPerson = {
  id: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
};

/** Une note, la mienne ou celle de l'autre (une fois révélée). */
export type RatingReview = {
  rating: number;
  criteria: Partial<Record<RatingCriterion, CriterionVote>> | null;
  comment: string | null;
  submittedAt: string;
};

/** La réponse de `GET /deals/:id/rating`, champ à champ. */
type RatingContextDto = {
  bookingId: string;
  viewerRole: 'SHIPPER' | 'CARRIER';
  ratedRole: 'SHIPPER' | 'CARRIER';
  person: RatingPerson;
  corridor: { originCity: string; destinationCity: string };
  completedAt: string | null;
  windowEndsAt: string | null;
  canRate: boolean;
  cannotRateReason: string | null;
  myRating: RatingReview | null;
  counterpartHasRated: boolean;
  revealedAt: string | null;
  counterpartRating: RatingReview | null;
};

export type RatingContext = RatingContextDto;

export async function getRatingContext(dealId: string): Promise<RatingContext> {
  const context = await apiFetch<RatingContextDto>(`/deals/${dealId}/rating`);
  if (context.viewerRole !== 'SHIPPER') throw new WrongRatingSideError();
  return context;
}

/**
 * Le compte connecté est le VOYAGEUR de ce deal. L'app n'a pas encore son
 * mode Voyageur : les critères de notation d'un Expéditeur, leurs textes et
 * la fiche qui va avec n'existent pas. On le dit plutôt que d'afficher un
 * écran à moitié traduit (A203).
 */
export class WrongRatingSideError extends Error {
  readonly code = 'WRONG_VIEWER_ROLE';
  constructor() {
    super('Not the shipper of this deal');
    this.name = 'WrongRatingSideError';
  }
}

export type SubmitRatingInput = {
  rating: number;
  criteria?: Partial<Record<RatingCriterion, CriterionVote>>;
  comment?: string;
};

export type SubmitRatingResult = {
  bookingId: string;
  submittedAt: string;
  /** `true` = l'autre avait déjà noté : les deux avis deviennent publics MAINTENANT. */
  revealed: boolean;
  revealedAt: string | null;
};

export function submitRating(dealId: string, input: SubmitRatingInput): Promise<SubmitRatingResult> {
  return apiFetch<SubmitRatingResult>(`/deals/${dealId}/rating`, { method: 'POST', body: input });
}
