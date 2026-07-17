import { z } from "zod";
import { ObjectIdSchema } from "../common";
import {
  TripStatusSchema, TransportModeSchema, TripTypeSchema, FlightTypeSchema,
  TrainTripTypeSchema, CarTripFlexibilitySchema, TicketVerificationStatusSchema,
  LocationKindSchema, LocationFlexibilitySchema, ParcelCategorySchema,
  TripActionSchema,
} from "./trip.enums";

/**
 * @packages/api-contracts — trip schemas
 * ======================================
 * Entités + corps de requêtes/réponses de trip-service.
 * Champs alignés sur le schéma Prisma et les contrôleurs réels
 * (trip.controller.ts, upload.controller.ts) — rien d'inventé.
 */

/* ══ Sous-documents ═══════════════════════════════════════════ */

export const TripDocumentSchema = z
  .object({
    id: z.string(),
    url: z.string().meta({ description: "URL ImageKit du document" }),
    fileId: z.string().meta({ description: "Identifiant ImageKit (pour suppression)" }),
    name: z.string(),
    mimeType: z.string().nullish(),
    uploadedAt: z.iso.datetime().nullish(),
  })
  .meta({ id: "TripDocument" });

export const TripLocationPointSchema = z
  .object({
    kind: LocationKindSchema,
    details: z.string().nullish().meta({ example: "Terminal 2E, devant le Relay" }),
    flexibility: LocationFlexibilitySchema,
    radiusKm: z.number().positive().nullish().meta({ description: "Requis si flexibility=RADIUS" }),
  })
  .meta({ id: "TripLocationPoint" });

export const CategoryConditionSchema = z
  .object({
    category: ParcelCategorySchema,
    priceAmountCents: z.number().int().nonnegative().meta({
      description: "Prix en centimes (DEV-01 : jamais de float)",
      example: 1500,
    }),
  })
  .meta({ id: "CategoryCondition" });

/* ══ Entité Trip (vue owner) ══════════════════════════════════ */

export const TripSchema = z
  .object({
    id: ObjectIdSchema,
    userId: ObjectIdSchema,
    status: TripStatusSchema,
    transportMode: TransportModeSchema.nullish(),
    tripType: TripTypeSchema.nullish(),

    /* Itinéraire */
    originLabel: z.string().nullish(),
    originPlaceId: z.string().nullish(),
    originCity: z.string().nullish(),
    originRegion: z.string().nullish(),
    originCountry: z.string().nullish(),
    originLat: z.number().nullish(),
    originLng: z.number().nullish(),
    destinationLabel: z.string().nullish(),
    destinationPlaceId: z.string().nullish(),
    destinationCity: z.string().nullish(),
    destinationRegion: z.string().nullish(),
    destinationCountry: z.string().nullish(),
    destinationLat: z.number().nullish(),
    destinationLng: z.number().nullish(),

    /* Dates & horaires (locaux — D24 : fuseaux ajoutés en B1) */
    departureDateLocal: z.string().nullish().meta({ example: "2026-08-02" }),
    departureTimeLocal: z.string().nullish().meta({ example: "14:00" }),
    arrivalDateLocal: z.string().nullish(),
    arrivalTimeLocal: z.string().nullish(),

    /* Transport (détail par mode) */
    flightType: FlightTypeSchema.nullish(),
    flightLayoverCities: z.array(z.string()).nullish(),
    trainTripType: TrainTripTypeSchema.nullish(),
    trainStopCities: z.array(z.string()).nullish(),
    carTripFlexibility: CarTripFlexibilitySchema.nullish(),
    travelReference: z.string().nullish().meta({ example: "AF 838" }),
    ticketVerificationStatus: TicketVerificationStatusSchema.nullish(),

    /* Offre */
    acceptedCategories: z.array(ParcelCategorySchema),
    categoryConditions: z.array(CategoryConditionSchema).nullish(),
    pickupLocations: z.array(TripLocationPointSchema).nullish(),
    deliveryLocations: z.array(TripLocationPointSchema).nullish(),
    handDeliveryOnly: z.boolean(),
    instantBooking: z.boolean().meta({ description: "D20 : sans effet sur la machine d'états v1 (badge)" }),
    currencyCode: z.string().default("EUR"),
    notes: z.string().nullish(),

    /* Documents */
    documents: z.array(TripDocumentSchema).nullish(),

    /* Lifecycle */
    publishedAt: z.iso.datetime().nullish(),
    cancelledAt: z.iso.datetime().nullish(),
    isDeleted: z.boolean().optional(),
    deletedAt: z.iso.datetime().nullish(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Trip" });
export type Trip = z.infer<typeof TripSchema>;

/* ══ Réponses ═════════════════════════════════════════════════ */

export const AllowedActionsSchema = z
  .array(TripActionSchema)
  .meta({ id: "AllowedActions" });

export const TripResponseSchema = z
  .object({
    trip: TripSchema,
    allowedActions: AllowedActionsSchema.optional(),
  })
  .meta({ id: "TripResponse" });

export const TripsListResponseSchema = z
  .object({
    trips: z.array(TripSchema),
  })
  .meta({ id: "TripsListResponse" });

/* ══ Corps de requêtes ════════════════════════════════════════ */

// POST / et PUT /:id partagent la même forme (PUT = partiel)
export const CreateTripBodySchema = z
  .object({
    transportMode: TransportModeSchema,
    tripType: TripTypeSchema,
    originLabel: z.string().min(1),
    originPlaceId: z.string().nullish(),
    originCity: z.string().nullish(),
    originRegion: z.string().nullish(),
    originCountry: z.string().nullish(),
    originLat: z.number().nullish(),
    originLng: z.number().nullish(),
    destinationLabel: z.string().min(1),
    destinationPlaceId: z.string().nullish(),
    destinationCity: z.string().nullish(),
    destinationRegion: z.string().nullish(),
    destinationCountry: z.string().nullish(),
    destinationLat: z.number().nullish(),
    destinationLng: z.number().nullish(),
    departureDateLocal: z.string().nullish(),
    departureTimeLocal: z.string().nullish(),
    arrivalDateLocal: z.string().nullish(),
    arrivalTimeLocal: z.string().nullish(),
    flightType: FlightTypeSchema.nullish(),
    flightLayoverCities: z.array(z.string()).nullish(),
    trainTripType: TrainTripTypeSchema.nullish(),
    trainStopCities: z.array(z.string()).nullish(),
    carTripFlexibility: CarTripFlexibilitySchema.nullish(),
    travelReference: z.string().nullish(),
    acceptedCategories: z.array(ParcelCategorySchema).min(1),
    categoryConditions: z.array(CategoryConditionSchema).nullish(),
    pickupLocations: z.array(TripLocationPointSchema).nullish(),
    deliveryLocations: z.array(TripLocationPointSchema).nullish(),
    handDeliveryOnly: z.boolean().default(false),
    instantBooking: z.boolean().default(false),
    currencyCode: z.string().default("EUR"),
    notes: z.string().nullish(),
    publish: z.boolean().default(false).meta({ description: "true = créer directement en PUBLISHED (si gates onboarding/Stripe OK)" }),
  })
  .meta({ id: "CreateTripBody" });
export type CreateTripBody = z.infer<typeof CreateTripBodySchema>;

export const UpdateTripBodySchema = CreateTripBodySchema.partial().meta({ id: "UpdateTripBody" });

export const MyTripsQuerySchema = z
  .object({
    status: TripStatusSchema.optional().meta({ description: "Filtrer par statut" }),
  })
  .meta({ id: "MyTripsQuery" });

export const DeleteTripQuerySchema = z
  .object({
    hard: z.enum(["true", "false"]).optional().meta({
      description: "true = soft delete d'un brouillon (isDeleted) · absent = alias de cancel (backward-compat)",
    }),
  })
  .meta({ id: "DeleteTripQuery" });

export const AddDocumentsBodySchema = z
  .object({
    documents: z.array(
      TripDocumentSchema.pick({ url: true, fileId: true, name: true, mimeType: true })
    ).min(1).max(5),
  })
  .meta({ id: "AddDocumentsBody" });

/* ══ Uploads (upload.routes.ts) ═══════════════════════════════ */

export const ImageKitAuthResponseSchema = z
  .object({
    token: z.string(),
    expire: z.number().meta({ description: "Timestamp d'expiration" }),
    signature: z.string(),
  })
  .meta({ id: "ImageKitAuthResponse", description: "Paramètres d'authentification pour upload direct navigateur → ImageKit" });

export const ImageKitFileIdParamSchema = z.object({
  fileId: z.string().min(1),
});
