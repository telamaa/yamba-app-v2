import { z } from "zod";

/* ────────────────────────────────────────────────────────────
 * Zod schemas for Trip CRUD payloads.
 *
 * Validation strategy:
 *   - Zod handles SHAPE (types, enums, lengths, intra-payload rules)
 *   - Zod handles NORMALIZATION (trim, ISO codes uppercase, date coercion)
 *   - Controller handles DB-dependent rules (ownership, status, Stripe…)
 *
 * Convention: enum values are SCREAMING_SNAKE_CASE to match Prisma.
 * The frontend is responsible for mapping its camelCase enums before HTTP.
 *
 * Compatible with Zod v4 (uses "custom" literal and error.issues).
 * ──────────────────────────────────────────────────────────── */

/* ── Reusable enums ─────────────────────────────────── */

export const TransportModeEnum = z.enum(["PLANE", "TRAIN", "CAR"]);
export const TripTypeEnum = z.enum(["ONE_WAY", "ROUND_TRIP"]);
export const FlightTypeEnum = z.enum(["DIRECT", "WITH_LAYOVER"]);
export const TrainTripTypeEnum = z.enum(["DIRECT", "WITH_CONNECTION"]);
export const CarTripFlexibilityEnum = z.enum(["DIRECT", "DETOUR_BY_AGREEMENT"]);

export const ParcelCategoryEnum = z.enum([
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
]);

export const LocationKindEnum = z.enum(["AIRPORT", "TRAIN_STATION", "CITY_AREA"]);
export const LocationFlexibilityEnum = z.enum(["EXACT", "RADIUS", "CITY_WIDE"]);

export const CurrencyCodeEnum = z.enum(["EUR"]); // extendable later

/* ── Reusable helpers ───────────────────────────────── */

const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max).optional().nullable();

// ISO code: trim + uppercase, allow null/empty
const isoCodeSchema = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length > 0 ? t.toUpperCase() : null;
  })
  .optional();

// Date or ISO string → Date | null
const optionalDateLike = z
  .union([z.string().min(1), z.date(), z.null()])
  .transform((v) => {
    if (v == null) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  })
  .optional();

/* ── Trip location point (shared by create + update) ── */

export const tripLocationPointSchema = z
  .object({
    kind: LocationKindEnum,
    details: optionalTrimmedString(120),
    flexibility: LocationFlexibilityEnum,
    radiusKm: z.number().int().min(1).max(100).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.flexibility === "RADIUS" && (data.radiusKm == null || data.radiusKm <= 0)) {
      ctx.addIssue({
        code: "custom",
        message: "radiusKm is required when flexibility is RADIUS",
        path: ["radiusKm"],
      });
    }
  });

export const categoryConditionSchema = z.object({
  category: ParcelCategoryEnum,
  priceAmountCents: z.number().int().min(0).max(100_000_000),
});

/* ── CREATE schema ──────────────────────────────────── */

export const createTripSchema = z
  .object({
    transportMode: TransportModeEnum,
    tripType: TripTypeEnum.optional(),

    // Origin
    originLabel: optionalTrimmedString(200),
    originPlaceId: optionalTrimmedString(150),
    originCity: z.string().trim().min(1).max(150),
    originCityCode: isoCodeSchema,
    originRegion: optionalTrimmedString(150),
    originRegionCode: isoCodeSchema,
    originCountry: optionalTrimmedString(150),
    originCountryCode: isoCodeSchema,
    originLat: z.number().optional().nullable(),
    originLng: z.number().optional().nullable(),
    originTimezone: optionalTrimmedString(50),

    // Destination
    destinationLabel: optionalTrimmedString(200),
    destinationPlaceId: optionalTrimmedString(150),
    destinationCity: z.string().trim().min(1).max(150),
    destinationCityCode: isoCodeSchema,
    destinationRegion: optionalTrimmedString(150),
    destinationRegionCode: isoCodeSchema,
    destinationCountry: optionalTrimmedString(150),
    destinationCountryCode: isoCodeSchema,
    destinationLat: z.number().optional().nullable(),
    destinationLng: z.number().optional().nullable(),
    destinationTimezone: optionalTrimmedString(50),

    // Dates
    departureDateLocal: optionalTrimmedString(20),
    arrivalDateLocal: optionalTrimmedString(20),
    departureTimeLocal: optionalTrimmedString(10),
    arrivalTimeLocal: optionalTrimmedString(10),
    departureAt: optionalDateLike,
    arrivalAt: optionalDateLike,
    returnDepartureAt: optionalDateLike,
    returnArrivalAt: optionalDateLike,

    // Mode-specific
    flightType: FlightTypeEnum.optional().nullable(),
    trainTripType: TrainTripTypeEnum.optional().nullable(),
    carTripFlexibility: CarTripFlexibilityEnum.optional().nullable(),
    flightLayoverCities: z.array(z.string().trim().max(150)).max(10).optional(),
    trainStopCities: z.array(z.string().trim().max(150)).max(10).optional(),
    travelReference: optionalTrimmedString(50),

    // Conditions
    acceptedCategories: z.array(ParcelCategoryEnum).max(20).optional(),
    categoryConditions: z.array(categoryConditionSchema).max(20).optional(),

    // ⭐ NEW : Locations
    pickupLocations: z.array(tripLocationPointSchema).max(10).optional(),
    deliveryLocations: z.array(tripLocationPointSchema).max(10).optional(),

    handDeliveryOnly: z.boolean().optional(),
    instantBooking: z.boolean().optional(),
    currencyCode: CurrencyCodeEnum.optional(),
    maxSlots: z.number().int().min(1).max(100).optional().nullable(),
    notes: optionalTrimmedString(2000),

    publish: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.publish !== true) return;

    // Publish-only validation: locations
    if (!data.pickupLocations || data.pickupLocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one pickup location is required to publish.",
        path: ["pickupLocations"],
      });
    }
    if (!data.deliveryLocations || data.deliveryLocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one delivery location is required to publish.",
        path: ["deliveryLocations"],
      });
    }

    // Publish-only validation: categories
    if (!data.acceptedCategories || data.acceptedCategories.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one accepted category is required to publish.",
        path: ["acceptedCategories"],
      });
    }

    // Publish-only validation: mode-specific subtypes
    if (data.transportMode === "PLANE" && !data.flightType) {
      ctx.addIssue({
        code: "custom",
        message: "Flight type is required for plane trips.",
        path: ["flightType"],
      });
    }
    if (data.transportMode === "TRAIN" && !data.trainTripType) {
      ctx.addIssue({
        code: "custom",
        message: "Train trip type is required for train trips.",
        path: ["trainTripType"],
      });
    }
    if (data.transportMode === "CAR" && !data.carTripFlexibility) {
      ctx.addIssue({
        code: "custom",
        message: "Car trip flexibility is required for car trips.",
        path: ["carTripFlexibility"],
      });
    }

    // Publish-only validation: departure must exist and be in the future
    if (!data.departureAt) {
      ctx.addIssue({
        code: "custom",
        message: "Departure date is required to publish.",
        path: ["departureAt"],
      });
    } else if (data.departureAt.getTime() < Date.now()) {
      ctx.addIssue({
        code: "custom",
        message: "Departure date must be in the future.",
        path: ["departureAt"],
      });
    }
  });

/* ── UPDATE schema ──────────────────────────────────── */

// All fields optional for partial updates.
// DB-dependent publish checks stay in the controller.
export const updateTripSchema = z.object({
  transportMode: TransportModeEnum.optional(),
  tripType: TripTypeEnum.optional(),

  originLabel: optionalTrimmedString(200),
  originPlaceId: optionalTrimmedString(150),
  originCity: z.string().trim().min(1).max(150).optional(),
  originCityCode: isoCodeSchema,
  originRegion: optionalTrimmedString(150),
  originRegionCode: isoCodeSchema,
  originCountry: optionalTrimmedString(150),
  originCountryCode: isoCodeSchema,
  originLat: z.number().optional().nullable(),
  originLng: z.number().optional().nullable(),
  originTimezone: optionalTrimmedString(50),

  destinationLabel: optionalTrimmedString(200),
  destinationPlaceId: optionalTrimmedString(150),
  destinationCity: z.string().trim().min(1).max(150).optional(),
  destinationCityCode: isoCodeSchema,
  destinationRegion: optionalTrimmedString(150),
  destinationRegionCode: isoCodeSchema,
  destinationCountry: optionalTrimmedString(150),
  destinationCountryCode: isoCodeSchema,
  destinationLat: z.number().optional().nullable(),
  destinationLng: z.number().optional().nullable(),
  destinationTimezone: optionalTrimmedString(50),

  departureDateLocal: optionalTrimmedString(20),
  arrivalDateLocal: optionalTrimmedString(20),
  departureTimeLocal: optionalTrimmedString(10),
  arrivalTimeLocal: optionalTrimmedString(10),
  departureAt: optionalDateLike,
  arrivalAt: optionalDateLike,
  returnDepartureAt: optionalDateLike,
  returnArrivalAt: optionalDateLike,

  flightType: FlightTypeEnum.optional().nullable(),
  trainTripType: TrainTripTypeEnum.optional().nullable(),
  carTripFlexibility: CarTripFlexibilityEnum.optional().nullable(),
  flightLayoverCities: z.array(z.string().trim().max(150)).max(10).optional(),
  trainStopCities: z.array(z.string().trim().max(150)).max(10).optional(),
  travelReference: optionalTrimmedString(50),

  acceptedCategories: z.array(ParcelCategoryEnum).max(20).optional(),
  categoryConditions: z.array(categoryConditionSchema).max(20).optional(),

  pickupLocations: z.array(tripLocationPointSchema).max(10).optional(),
  deliveryLocations: z.array(tripLocationPointSchema).max(10).optional(),

  handDeliveryOnly: z.boolean().optional(),
  instantBooking: z.boolean().optional(),
  currencyCode: CurrencyCodeEnum.optional(),
  maxSlots: z.number().int().min(1).max(100).optional().nullable(),
  notes: optionalTrimmedString(2000),

  publish: z.boolean().optional(),
});

/* ── Inferred types ────────────────────────────────── */

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TripLocationPointInput = z.infer<typeof tripLocationPointSchema>;
export type CategoryConditionInput = z.infer<typeof categoryConditionSchema>;

/* ── Error formatter ───────────────────────────────── */

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Invalid input.";
  const path = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}
