import { z } from "zod";
import { ObjectIdSchema } from "../common";
import {
  TransportModeSchema, TripTypeSchema, FlightTypeSchema, TrainTripTypeSchema,
  CarTripFlexibilitySchema, ParcelCategorySchema,
} from "./trip.enums";
import { CategoryConditionSchema, TripLocationPointSchema } from "./trip.schema";

/**
 * @packages/api-contracts — trip public schemas
 * =============================================
 * GET /trips/:id/public : DTO STRUCTURÉ (origin/destination/dates/tripper
 * imbriqués), distinct du Trip plat de la vue owner. Miroir exact du
 * publicDto construit dans getPublicTrip (trip.controller.ts).
 *
 * Seuls les trips PUBLISHED sont servis : les champs garantis par les
 * gates de publication (city, transportMode, departureAt) sont non-nulls.
 */

/* ══ Sous-objets ══════════════════════════════════════════════ */

export const PublicPlaceSchema = z
  .object({
    label: z.string().nullish(),
    placeId: z.string().nullish(),
    city: z.string().meta({ description: "Non-null : requis par le gate de publication" }),
    cityCode: z.string().nullish(),
    region: z.string().nullish(),
    regionCode: z.string().nullish(),
    country: z.string().nullish(),
    countryCode: z.string().nullish(),
    lat: z.number().nullish(),
    lng: z.number().nullish(),
    timezone: z.string().nullish(),
  })
  .meta({ id: "PublicPlace" });

export const PublicTripDatesSchema = z
  .object({
    departureAt: z.iso.datetime().meta({ description: "Non-null : requis par le gate de publication" }),
    arrivalAt: z.iso.datetime().nullish(),
    returnDepartureAt: z.iso.datetime().nullish(),
    returnArrivalAt: z.iso.datetime().nullish(),
    departureDateLocal: z.string().nullish(),
    arrivalDateLocal: z.string().nullish(),
    departureTimeLocal: z.string().nullish(),
    arrivalTimeLocal: z.string().nullish(),
  })
  .meta({ id: "PublicTripDates" });

export const PublicCarrierSchema = z
  .object({
    id: ObjectIdSchema,
    name: z.string().nullish(),
    bio: z.string().nullish(),
    isVerified: z.boolean(),
    isSuperCarrier: z.boolean(),
    ratingsAvg: z.number().nullish(),
    ratingsCount: z.number().int(),
    totalTripsPublished: z.number().int(),
    totalParcelsCarried: z.number().int(),
  })
  .meta({ id: "PublicCarrier" });

export const PublicTripperSchema = z
  .object({
    id: ObjectIdSchema,
    publicSlug: z.string().nullish(),
    firstName: z.string().nullish(),
    lastInitial: z.string().meta({ description: "Initiale du nom, '' si absent (privacy)" }),
    avatarUrl: z.string().nullable(),
    memberSince: z.iso.datetime(),
    carrier: PublicCarrierSchema.nullable(),
  })
  .meta({ id: "PublicTripper" });

/* ══ DTO principal ════════════════════════════════════════════ */

export const PublicTripSchema = z
  .object({
    id: ObjectIdSchema,
    status: z.literal("PUBLISHED").meta({ description: "Seuls les trips PUBLISHED sont servis (404 sinon)" }),
    transportMode: TransportModeSchema,
    tripType: TripTypeSchema.nullish(),

    origin: PublicPlaceSchema,
    destination: PublicPlaceSchema,
    dates: PublicTripDatesSchema,

    flightType: FlightTypeSchema.nullish(),
    trainTripType: TrainTripTypeSchema.nullish(),
    carTripFlexibility: CarTripFlexibilitySchema.nullish(),
    flightLayoverCities: z.array(z.string()),
    trainStopCities: z.array(z.string()),
    travelReference: z.string().nullish(),

    acceptedCategories: z.array(ParcelCategorySchema),
    categoryConditions: z.array(CategoryConditionSchema),
    pickupLocations: z.array(TripLocationPointSchema),
    deliveryLocations: z.array(TripLocationPointSchema),

    handDeliveryOnly: z.boolean(),
    instantBooking: z.boolean(),
    currencyCode: z.string(),
    notes: z.string().nullish(),

    maxSlots: z.number().int().nullable(),
    bookedSlots: z.number().int(),
    remainingSlots: z.number().int().nullable().meta({ description: "max(0, maxSlots - bookedSlots) — null si capacité illimitée" }),

    minPriceCents: z.number().int().nullable(),
    ticketVerified: z.boolean().meta({ description: "true ssi ticketVerificationStatus = VERIFIED" }),

    tripper: PublicTripperSchema,
    publishedAt: z.iso.datetime().nullish(),
  })
  .meta({ id: "PublicTrip", description: "Vue publique filtrée d'un trip PUBLISHED" });

/* ══ Réponses ═════════════════════════════════════════════════ */

export const PublicTripResponseSchema = z
  .object({
    success: z.literal(true),
    trip: PublicTripSchema,
  })
  .meta({ id: "PublicTripResponse" });

/**
 * 404 renvoyé DIRECTEMENT par le controller (hors error-middleware) :
 * format { success: false, message } ≠ ErrorResponse. Fidèle au réel.
 */
export const PublicNotFoundSchema = z
  .object({
    success: z.literal(false),
    message: z.string().meta({ example: "Trip not found." }),
  })
  .meta({ id: "PublicNotFound", description: "404 de la route publique (court-circuite le middleware d'erreurs)" });
