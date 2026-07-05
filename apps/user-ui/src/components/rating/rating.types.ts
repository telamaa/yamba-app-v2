/**
 * rating.types.ts
 * ===============
 * Types du module de notation mutuelle post-Deal (COMPLETED).
 * Module PARTAGÉ : paramétré par le rôle de la personne notée.
 *  - ratedRole CARRIER : l'Expéditeur note le Voyageur (avatar violet)
 *  - ratedRole SHIPPER : le Voyageur note l'Expéditeur (avatar teal)
 */

/** Rôle de la personne NOTÉE */
export type RatedRole = "CARRIER" | "SHIPPER";

/** Critères diagnostiques par rôle noté */
export type CarrierCriterionId = "PUNCTUALITY" | "COMMUNICATION" | "PARCEL_CARE";
export type ShipperCriterionId = "DECLARATION_CLARITY" | "RESPONSIVENESS" | "PUNCTUALITY";
export type CriterionId = CarrierCriterionId | ShipperCriterionId;

export type CriterionVote = "UP" | "DOWN";

export type RatingPerson = {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  dealCount: number; // deals côté carrier / envois côté shipper
  isVerified: boolean;
};

export type RatingContext = {
  dealId: string;
  ratedRole: RatedRole;
  person: RatingPerson;
  raterName: string; // "Aminata T." — pour l'encart d'attribution
  amountEur: number; // versé (côté sender) ou reçu (côté carrier)
  originCity: string;
  destinationCity: string;
  completedAt: string; // ISO
};

export type SubmitRatingPayload = {
  overallStars: number; // 1-5, seul champ requis
  criteria: Partial<Record<CriterionId, CriterionVote>>;
  comment?: string; // max 500
};

export const RATING_COMMENT_MAX_LENGTH = 280;

/** Critères par rôle noté (ordre d'affichage) */
export const CARRIER_CRITERIA: CarrierCriterionId[] = [
  "PUNCTUALITY",
  "COMMUNICATION",
  "PARCEL_CARE",
];

export const SHIPPER_CRITERIA: ShipperCriterionId[] = [
  "DECLARATION_CLARITY",
  "RESPONSIVENESS",
  "PUNCTUALITY",
];
