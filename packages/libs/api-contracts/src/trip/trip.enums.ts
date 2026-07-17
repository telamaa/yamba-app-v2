import { z } from "zod";

/**
 * @packages/api-contracts — trip enums
 * ====================================
 * Miroirs 1:1 des enums Prisma (schema.prisma) consommés par la surface
 * trips, + TripAction (state machine, trip.lifecycle).
 * ⚠️ Source de vérité : schema.prisma. Toute divergence est un bug.
 */

/* ══ Enums Prisma ═════════════════════════════════════════════ */

export const TripStatusSchema = z
  .enum(["DRAFT", "PUBLISHED", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"])
  .meta({ id: "TripStatus" });
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const TransportModeSchema = z
  .enum(["PLANE", "TRAIN", "CAR"])
  .meta({ id: "TransportMode" });
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const TripTypeSchema = z
  .enum(["ONE_WAY", "ROUND_TRIP"])
  .meta({ id: "TripType" });
export type TripType = z.infer<typeof TripTypeSchema>;

export const FlightTypeSchema = z
  .enum(["DIRECT", "WITH_LAYOVER"])
  .meta({ id: "FlightType" });
export type FlightType = z.infer<typeof FlightTypeSchema>;

export const TrainTripTypeSchema = z
  .enum(["DIRECT", "WITH_CONNECTION"])
  .meta({ id: "TrainTripType" });
export type TrainTripType = z.infer<typeof TrainTripTypeSchema>;

export const CarTripFlexibilitySchema = z
  .enum(["DIRECT", "DETOUR_BY_AGREEMENT"])
  .meta({ id: "CarTripFlexibility" });
export type CarTripFlexibility = z.infer<typeof CarTripFlexibilitySchema>;

export const TicketVerificationStatusSchema = z
  .enum(["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED"])
  .meta({ id: "TicketVerificationStatus" });
export type TicketVerificationStatus = z.infer<typeof TicketVerificationStatusSchema>;

export const LocationKindSchema = z
  .enum(["AIRPORT", "TRAIN_STATION", "CITY_AREA"])
  .meta({ id: "LocationKind" });
export type LocationKind = z.infer<typeof LocationKindSchema>;

export const LocationFlexibilitySchema = z
  .enum(["EXACT", "RADIUS", "CITY_WIDE"])
  .meta({ id: "LocationFlexibility" });
export type LocationFlexibility = z.infer<typeof LocationFlexibilitySchema>;

export const ParcelCategorySchema = z
  .enum([
    "CLOTHES",
    "SHOES",
    "FASHION_ACCESSORIES",
    "OTHER_ACCESSORIES",
    "BOOKS",
    "DOCUMENTS",
    "SMALL_TOYS",
    "PHONE",
    "COMPUTER",
    "OTHER_ELECTRONICS",
    "CHECKED_BAG_23KG",
    "CABIN_BAG_12KG",
  ])
  .meta({
    id: "ParcelCategory",
    description:
      "Enum actuel (pré-D14). La migration vers les 8 familles de risque CAT-02 fera l'objet d'une PR dédiée (mapping conservé).",
  });
export type ParcelCategory = z.infer<typeof ParcelCategorySchema>;

/* ══ State machine (trip.lifecycle) ═══════════════════════════ */

export const TripActionSchema = z
  .enum([
    "edit",
    "publish",
    "unpublish",
    "pause",
    "resume",
    "cancel",
    "restore",
    "archive",
    "delete",
  ])
  .meta({
    id: "TripAction",
    description:
      "Actions de la state machine trip (canPerform/getAllowedActions). Renvoyées dans allowedActions pour piloter les CTAs front.",
  });
export type TripAction = z.infer<typeof TripActionSchema>;
