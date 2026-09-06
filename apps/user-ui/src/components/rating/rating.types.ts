/**
 * rating.types.ts — notation mutuelle, types front (B5-PR2)
 * ==========================================================
 * Miroir de lecture du contrat `RatingContextResponse` / `SubmitRatingRequest`
 * (@packages/api-contracts, source de vérité serveur). Décision 2A : l'écran
 * ne montre NI la note moyenne NI le nombre de deals de la personne notée
 * (ancrage) — seulement qui, quel trajet, quand.
 */

export type RatedRole = "CARRIER" | "SHIPPER";

export type CarrierCriterionId = "PUNCTUALITY" | "COMMUNICATION" | "PARCEL_CARE";
export type ShipperCriterionId = "DECLARATION_CLARITY" | "RESPONSIVENESS" | "PUNCTUALITY";
export type CriterionId = CarrierCriterionId | ShipperCriterionId;
export type CriterionVote = "UP" | "DOWN";

export type RatingPerson = {
  id: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
};

export type MyRating = {
  rating: number;
  criteria: Partial<Record<CriterionId, CriterionVote>> | null;
  comment: string | null;
  submittedAt: string;
};

export type RatingContext = {
  dealId: string;
  viewerRole: RatedRole;
  ratedRole: RatedRole;
  person: RatingPerson;
  originCity: string;
  destinationCity: string;
  completedAt: string | null;
  windowEndsAt: string | null;
  canRate: boolean;
  cannotRateReason: string | null;
  myRating: MyRating | null;
  counterpartHasRated: boolean;
  revealedAt: string | null;
  /** Visible seulement une fois révélé (double-aveugle, D53). */
  counterpartRating: MyRating | null;
};

export type SubmitRatingPayload = {
  rating: number; // 1-5, seul champ requis
  criteria: Partial<Record<CriterionId, CriterionVote>>;
  comment?: string; // max 280
};

export const RATING_COMMENT_MAX_LENGTH = 280;

/** Critères par rôle noté (ordre d'affichage) */
export const CARRIER_CRITERIA: CarrierCriterionId[] = ["PUNCTUALITY", "COMMUNICATION", "PARCEL_CARE"];
export const SHIPPER_CRITERIA: ShipperCriterionId[] = ["DECLARATION_CLARITY", "RESPONSIVENESS", "PUNCTUALITY"];
