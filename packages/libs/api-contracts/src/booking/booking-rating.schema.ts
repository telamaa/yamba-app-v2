/**
 * booking-rating.schema.ts — notation mutuelle double-aveugle (B5, D53)
 * ====================================================================
 * Emplacement : packages/libs/api-contracts/src/booking/booking-rating.schema.ts
 *
 * `POST /deals/:id/rating` (les deux rôles, deal COMPLETED, 14 jours, une
 * fois) et `GET /deals/:id/rating` (le contexte : qui je note, ma note, si
 * l'autre a noté, révélation). Réputation visible (D29①) : niveau calculé
 * serveur avec critères affichés — jamais une note opaque.
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { BookingViewerRoleSchema } from "./booking.enums";

/* ══ Paramètres serveur (spec §3.7, REP-03) ═══════════════════ */

export const RATING_WINDOW_DAYS = 14;
export const RATING_REMINDER_DAYS = [5, 7] as const;
export const RATING_COMMENT_MAX_LENGTH = 280;

export const CARRIER_RATING_CRITERIA = ["PUNCTUALITY", "COMMUNICATION", "PARCEL_CARE"] as const;
export const SHIPPER_RATING_CRITERIA = ["DECLARATION_CLARITY", "RESPONSIVENESS", "PUNCTUALITY"] as const;
export const RatingCriterionSchema = z
  .enum([...CARRIER_RATING_CRITERIA, ...SHIPPER_RATING_CRITERIA])
  .meta({ id: "RatingCriterion", description: "Optional thumbs criteria — carrier: punctuality, communication, parcel care · shipper: declaration clarity, responsiveness, punctuality" });
export type RatingCriterion = z.infer<typeof RatingCriterionSchema>;
export const RatingVoteSchema = z.enum(["UP", "DOWN"]).meta({ id: "RatingVote" });

export const SubmitRatingRequestSchema = z
  .object({
    rating: z.number().int().min(1).max(5).meta({ description: "1 (disappointing) … 5 (excellent) — the only required field" }),
    criteria: z.record(RatingCriterionSchema, RatingVoteSchema).optional().meta({ description: "Optional thumbs, only the criteria of the rated role are kept" }),
    comment: z.string().trim().max(RATING_COMMENT_MAX_LENGTH).optional().meta({ description: "Public, attributed, immutable — 280 chars max" }),
  })
  .meta({ id: "SubmitRatingRequest" });
export type SubmitRatingRequest = z.infer<typeof SubmitRatingRequestSchema>;

export const MyRatingSchema = z
  .object({
    rating: z.number().int(),
    criteria: z.record(RatingCriterionSchema, RatingVoteSchema).nullable(),
    comment: z.string().nullable(),
    submittedAt: z.iso.datetime(),
  })
  .meta({ id: "MyRating" });

export const RatingContextResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    /** Rôle du LECTEUR ; il note l'autre. */
    viewerRole: BookingViewerRoleSchema,
    ratedRole: BookingViewerRoleSchema.meta({ description: "The role being rated (opposite of viewerRole) — drives the criteria set" }),
    person: z.object({
      id: ObjectIdSchema,
      firstName: z.string(),
      lastInitial: z.string(),
      avatarUrl: z.string().nullable(),
    }),
    corridor: z.object({ originCity: z.string(), destinationCity: z.string() }),
    completedAt: z.iso.datetime().nullable(),
    windowEndsAt: z.iso.datetime().nullable().meta({ description: "completedAt + 14 days: rating closes and reviews are revealed" }),
    canRate: z.boolean().meta({ description: "Server verdict (state machine): COMPLETED, within the window, not rated yet by this role" }),
    cannotRateReason: z.string().nullable(),
    myRating: MyRatingSchema.nullable(),
    counterpartHasRated: z.boolean(),
    revealedAt: z.iso.datetime().nullable().meta({ description: "Double-blind lifted: both rated, or window elapsed" }),
    /** Visible seulement une fois révélé (double-aveugle, D53). */
    counterpartRating: MyRatingSchema.nullable(),
  })
  .meta({ id: "RatingContextResponse", description: "Everything the rating screen needs — the frontend reflects, never decides" });
export type RatingContextResponse = z.infer<typeof RatingContextResponseSchema>;

export const SubmitRatingResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    submittedAt: z.iso.datetime(),
    revealed: z.boolean().meta({ description: "true when the counterpart had already rated → both reviews revealed now" }),
    revealedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "SubmitRatingResponse" });
export type SubmitRatingResponse = z.infer<typeof SubmitRatingResponseSchema>;

/* ══ Réputation visible (D29①, REP-03) ════════════════════════ */

export const ReputationLevelSchema = z
  .enum(["NEW", "CONFIRMED", "TOP"])
  .meta({
    id: "ReputationLevel",
    description:
      "Public reputation level, computed server-side from explainable facts (D29①). Carrier: NEW < 3 completed deals · " +
      "CONFIRMED ≥ 3 · TOP ≥ 10 deals, revealed average ≥ 4.8, 0 post-acceptance cancellation. Shipper mirror ('reliable'): " +
      "CONFIRMED ≥ 3 · TOP ≥ 5 deals, ≥ 4.8, 0 late cancellation. Thresholds are server parameters.",
  });
export type ReputationLevel = z.infer<typeof ReputationLevelSchema>;

export type ReputationThresholds = { confirmedMinDeals: number; topMinDeals: number; topMinRating: number; topMaxLateCancellations: number };
export type ReputationParams = { carrier: ReputationThresholds; shipper: ReputationThresholds };
/** Défauts — servis par les paramètres de la plateforme depuis D62 (`reputation.*`). */
export const REPUTATION_PARAMS: ReputationParams = {
  carrier: { confirmedMinDeals: 3, topMinDeals: 10, topMinRating: 4.8, topMaxLateCancellations: 0 },
  shipper: { confirmedMinDeals: 3, topMinDeals: 5, topMinRating: 4.8, topMaxLateCancellations: 0 },
};

export const ReputationSummarySchema = z
  .object({
    level: ReputationLevelSchema,
    ratingsAvg: z.number().meta({ description: "Average of REVEALED reviews only (double-blind)" }),
    ratingsCount: z.number().int(),
    completedDealsCount: z.number().int(),
    lateCancellationsCount: z.number().int(),
  })
  .meta({ id: "ReputationSummary", description: "Badges + statistics, never an opaque score (D29①)" });
export type ReputationSummary = z.infer<typeof ReputationSummarySchema>;
