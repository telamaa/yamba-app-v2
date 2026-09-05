import { z } from "zod";
import { tripPerKgPricingFields } from "./trip-pricing.schema";
import { ObjectIdSchema } from "../common";
import {
  TripStatusSchema, TransportModeSchema, TripTypeSchema, FlightTypeSchema,
  TrainTripTypeSchema, CarTripFlexibilitySchema, TicketVerificationStatusSchema,
  LocationKindSchema, LocationFlexibilitySchema, ParcelCategorySchema,
  TripDocumentTypeSchema, TripDocumentStatusSchema, TripActionSchema,
} from "./trip.enums";

/**
 * @packages/api-contracts — trip schemas
 * ======================================
 * Entités + corps de requêtes/réponses de trip-service.
 * Champs alignés sur le schéma Prisma et les contrôleurs réels
 * (trip.controller.ts, upload.controller.ts) — rien d'inventé.
 *
 * Lot B : enveloppes corrigées sur le RÉEL du controller :
 *  - detail : { success, trip: { ...trip, allowedActions } } (imbriqué)
 *  - liste  : { success, trips: [...+allowedActions], count }
 *  - create/update/addDocuments : { success, message, trip }
 *  - transitions/deletes : { success, message } (aucun trip renvoyé)
 */

/* ══ Sous-documents ═══════════════════════════════════════════ */

export const TripDocumentSchema = z
  .object({
    id: ObjectIdSchema,
    type: TripDocumentTypeSchema,
    status: TripDocumentStatusSchema,
    url: z.string().meta({ description: "URL ImageKit du document" }),
    /* Champs absents de la vue liste (getMyTrips fait un select partiel
       {id, type, status, url}) — présents dans la vue détail (documents: true). */
    fileId: z.string().optional().meta({ description: "Identifiant ImageKit (pour suppression)" }),
    tripId: ObjectIdSchema.optional(),
    uploadedByUserId: ObjectIdSchema.nullish(),
    originalName: z.string().nullish(),
    mimeType: z.string().nullish(),
    sizeBytes: z.number().int().nullish(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    verifiedAt: z.iso.datetime().nullish(),
    rejectedAt: z.iso.datetime().nullish(),
    rejectionReason: z.string().nullish(),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
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

/* ══ Résumés relationnels (include du GET /trips/:id) ═════════ */

export const TripUserSummarySchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    avatar: z.object({ url: z.string() }).nullish(),
  })
  .meta({ id: "TripUserSummary", description: "Select partiel du user (vue détail owner)" });

export const TripCarrierSummarySchema = z
  .object({
    id: ObjectIdSchema,
    name: z.string().nullish(),
    ratingsAvg: z.number().nullish(),
    ratingsCount: z.number().int(),
    isVerified: z.boolean(),
  })
  .meta({ id: "TripCarrierSummary", description: "Select partiel de la carrierPage (vue détail owner)" });

/* ══ Entité Trip (vue owner) ══════════════════════════════════ */

export const TripSchema = z
  .object({
    id: ObjectIdSchema,
    userId: ObjectIdSchema,
    carrierPageId: ObjectIdSchema.nullish(),
    status: TripStatusSchema,
    currentStep: z.number().int().nullish().meta({ description: "Étape du wizard (1-3)" }),
    transportMode: TransportModeSchema.nullish(),
    tripType: TripTypeSchema.nullish(),

    /* Itinéraire — origin */
    originLabel: z.string().nullish(),
    originPlaceId: z.string().nullish(),
    originCity: z.string().nullish(),
    originCityCode: z.string().nullish().meta({ example: "CDG" }),
    originRegion: z.string().nullish(),
    originRegionCode: z.string().nullish(),
    originCountry: z.string().nullish(),
    originCountryCode: z.string().nullish().meta({ example: "FR" }),
    originLat: z.number().nullish(),
    originLng: z.number().nullish(),
    originTimezone: z.string().nullish().meta({ example: "Europe/Paris" }),

    /* Itinéraire — destination */
    destinationLabel: z.string().nullish(),
    destinationPlaceId: z.string().nullish(),
    destinationCity: z.string().nullish(),
    destinationCityCode: z.string().nullish(),
    destinationRegion: z.string().nullish(),
    destinationRegionCode: z.string().nullish(),
    destinationCountry: z.string().nullish(),
    destinationCountryCode: z.string().nullish().meta({ example: "CG" }),
    destinationLat: z.number().nullish(),
    destinationLng: z.number().nullish(),
    destinationTimezone: z.string().nullish().meta({ example: "Africa/Brazzaville" }),

    /* Dates & horaires */
    departureDateLocal: z.string().nullish().meta({ example: "2026-08-02" }),
    departureTimeLocal: z.string().nullish().meta({ example: "14:00" }),
    arrivalDateLocal: z.string().nullish(),
    arrivalTimeLocal: z.string().nullish(),
    departureAt: z.iso.datetime().nullish(),
    arrivalAt: z.iso.datetime().nullish(),
    returnDepartureAt: z.iso.datetime().nullish(),
    returnArrivalAt: z.iso.datetime().nullish(),

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
    // A28 — moteur PER_KG (D13/D14), une seule source etalee.
    ...tripPerKgPricingFields,
    reservedKg: z.number().nonnegative().nullish().meta({
      description: "CAP-02 — atomic server counter. remainingKg = capacityKg - reservedKg (derived, never stored)",
    }),
    pickupLocations: z.array(TripLocationPointSchema).nullish(),
    deliveryLocations: z.array(TripLocationPointSchema).nullish(),
    handDeliveryOnly: z.boolean(),
    instantBooking: z.boolean().meta({ description: "D20 : sans effet sur la machine d'états v1 (badge)" }),
    currencyCode: z.string().default("EUR"),
    maxSlots: z.number().int().nullish().meta({ description: "null = capacité illimitée" }),
    bookedSlots: z.number().int().meta({ description: "Slots réservés (chantier Booking)" }),
    notes: z.string().nullish(),

    /* Dénormalisés (recalculés par le service) */
    minPriceCents: z.number().int().nullish().meta({ description: "min(categoryConditions.priceAmountCents) — null si aucune condition ; les trips PER_KG restent null (moteurs incomparables, exclus du tri lowestPrice — A28)" }),
    departureHourLocal: z.number().int().nullish().meta({ description: "Heure locale de départ (0-23), pour les buckets de recherche" }),
    carrierRatingSnapshot: z.number().nullish().meta({ description: "Note carrier figée à la publication (tri bestRated)" }),

    /* Documents */
    documents: z.array(TripDocumentSchema).nullish(),

    /* Relations (présentes uniquement en vue détail GET /trips/:id) */
    user: TripUserSummarySchema.nullish(),
    carrierPage: TripCarrierSummarySchema.nullish(),

    /* Lifecycle */
    publishedAt: z.iso.datetime().nullish(),
    cancelledAt: z.iso.datetime().nullish(),
    archivedAt: z.iso.datetime().nullish(),
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

/** Trip enrichi par la state machine — allowedActions IMBRIQUÉ dans trip. */
export const TripWithActionsSchema = TripSchema
  .extend({ allowedActions: AllowedActionsSchema })
  .meta({
    id: "TripWithActions",
    description: "Trip + allowedActions (getAllowedActions) — pilote les CTAs front",
  });

/** GET /trips/:id — 200 */
export const TripResponseSchema = z
  .object({
    success: z.literal(true),
    trip: TripWithActionsSchema,
  })
  .meta({ id: "TripResponse" });

/** GET /trips/my — 200 */
export const TripsListResponseSchema = z
  .object({
    success: z.literal(true),
    trips: z.array(TripWithActionsSchema),
    count: z.number().int(),
  })
  .meta({ id: "TripsListResponse" });

/** POST /trips (201) · PUT /trips/:id (200) · POST /trips/:id/documents (201/200) */
export const TripMutationResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().meta({ example: "Trip published!" }),
    trip: TripSchema,
  })
  .meta({
    id: "TripMutationResponse",
    description: "Réponse des mutations renvoyant le trip (sans allowedActions)",
  });

/** Transitions lifecycle, deletes, suppression de document — { success, message } */
export const ActionResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().meta({ example: "Trip paused." }),
  })
  .meta({
    id: "ActionResponse",
    description: "Réponse minimale des actions (transitions, deletes) — aucun trip renvoyé",
  });

/* ══ Corps de requêtes ════════════════════════════════════════ */

// POST / et PUT /:id partagent la même forme (PUT = partiel)
export const CreateTripBodySchema = z
  .object({
    transportMode: TransportModeSchema,
    tripType: TripTypeSchema,

    originLabel: z.string().min(1),
    originPlaceId: z.string().nullish(),
    // Nullish : Trip.originCity est String? dans Prisma — un brouillon peut
    // être incomplet, c'est le gate de publication qui exige les villes.
    originCity: z.string().nullish(),
    originCityCode: z.string().nullish(),
    originRegion: z.string().nullish(),
    originRegionCode: z.string().nullish(),
    originCountry: z.string().nullish(),
    originCountryCode: z.string().nullish(),
    originLat: z.number().nullish(),
    originLng: z.number().nullish(),
    originTimezone: z.string().nullish(),

    destinationLabel: z.string().min(1),
    destinationPlaceId: z.string().nullish(),
    destinationCity: z.string().nullish(),
    destinationCityCode: z.string().nullish(),
    destinationRegion: z.string().nullish(),
    destinationRegionCode: z.string().nullish(),
    destinationCountry: z.string().nullish(),
    destinationCountryCode: z.string().nullish(),
    destinationLat: z.number().nullish(),
    destinationLng: z.number().nullish(),
    destinationTimezone: z.string().nullish(),

    departureDateLocal: z.string().nullish(),
    departureTimeLocal: z.string().nullish(),
    arrivalDateLocal: z.string().nullish(),
    arrivalTimeLocal: z.string().nullish(),
    departureAt: z.iso.datetime().nullish(),
    arrivalAt: z.iso.datetime().nullish(),
    returnDepartureAt: z.iso.datetime().nullish(),
    returnArrivalAt: z.iso.datetime().nullish(),

    flightType: FlightTypeSchema.nullish(),
    flightLayoverCities: z.array(z.string()).nullish(),
    trainTripType: TrainTripTypeSchema.nullish(),
    trainStopCities: z.array(z.string()).nullish(),
    carTripFlexibility: CarTripFlexibilitySchema.nullish(),
    travelReference: z.string().nullish(),

    acceptedCategories: z.array(ParcelCategorySchema).min(1),
    categoryConditions: z.array(CategoryConditionSchema).nullish(),
    // A28 — moteur PER_KG (D13/D14).
    ...tripPerKgPricingFields,
    pickupLocations: z.array(TripLocationPointSchema).nullish(),
    deliveryLocations: z.array(TripLocationPointSchema).nullish(),
    handDeliveryOnly: z.boolean().default(false),
    instantBooking: z.boolean().default(false),
    currencyCode: z.string().default("EUR"),
    maxSlots: z.number().int().positive().nullish(),
    notes: z.string().nullish(),

    publish: z.boolean().default(false).meta({
      description: "true = créer directement en PUBLISHED (si gates onboarding/Stripe/locations OK)",
    }),
  })
  .meta({ id: "CreateTripBody" });
export type CreateTripBody = z.infer<typeof CreateTripBodySchema>;

export const UpdateTripBodySchema = CreateTripBodySchema.partial().meta({ id: "UpdateTripBody" });

export const MyTripsQuerySchema = z
  .object({
    status: TripStatusSchema.optional().meta({
      description: "Filtrer par statut (insensible à la casse : le service fait toUpperCase())",
    }),
  })
  .meta({ id: "MyTripsQuery" });

export const DeleteTripQuerySchema = z
  .object({
    hard: z.enum(["true", "false"]).optional().meta({
      description: "true = soft delete d'un brouillon (isDeleted) · absent = alias de cancel (backward-compat)",
    }),
  })
  .meta({ id: "DeleteTripQuery" });

/** POST /trips/:id/documents — forme réelle validée par le controller. */
export const AddDocumentsBodySchema = z
  .object({
    documents: z
      .array(
        z.object({
          type: TripDocumentTypeSchema,
          fileId: z.string().min(1),
          url: z.string().min(1),
          originalName: z.string().optional(),
          mimeType: z.string().optional(),
          sizeBytes: z.number().int().positive().optional(),
          title: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .min(1)
      .meta({
        description:
          "Maximum côté serveur : paramètre documents.maxDocsPerTrip (défaut 5) · taille max par doc : documents.maxDocSizeMb (défaut 5 Mo) — D62",
      }),
  })
  .meta({ id: "AddDocumentsBody" });

/* ══ Uploads (upload.routes.ts) ═══════════════════════════════ */

export const ImageKitAuthResponseSchema = z
  .object({
    success: z.literal(true),
    token: z.string(),
    expire: z.number().meta({ description: "Timestamp Unix d'expiration (~30 min)" }),
    signature: z.string(),
    publicKey: z.string().optional().meta({ description: "IMAGEKIT_PUBLIC_KEY (absent si env non configuré)" }),
    urlEndpoint: z.string().optional().meta({ description: "IMAGEKIT_URL_ENDPOINT (absent si env non configuré)" }),
  })
  .meta({
    id: "ImageKitAuthResponse",
    description: "Paramètres d'authentification pour upload direct navigateur → ImageKit",
  });

export const ImageKitFileIdParamSchema = z.object({
  fileId: z.string().min(1),
});
