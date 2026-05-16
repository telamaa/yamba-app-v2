/**
 * create-trip.reverse-mapper.ts
 * ==============================
 * Converts a backend Trip object back to a frontend Draft for edit mode.
 *
 * Locations strategy:
 *  - The server stores only enabled locations (filtered at submit).
 *  - When loading for edit, we MERGE the saved server locations with the
 *    full set of defaults for the transport mode. This way, the user sees:
 *      • Their previously-enabled cards filled with the saved data
 *      • Plus the other available cards (disabled) for that transport mode,
 *        which they can toggle on if they want to add new locations.
 */

import type {
  Draft,
  PlaceInfo,
  TransportMode,
  TripType,
  FlightType,
  TrainTripType,
  CarTripFlexibility,
  ParcelCategory,
  CategoryCondition,
  TripDocumentDraft,
  TicketVerificationStatus,
  TripLocationPoint,
  LocationFlexibility,
} from "./create-trip.types";
import { getDefaultLocationsForMode } from "./create-trip.config";

function fromSnakeEnum<T extends string>(
  val: string | null | undefined,
  map: Record<string, T>
): T | null {
  if (!val) return null;
  return map[val] ?? null;
}

const TRANSPORT_MAP: Record<string, TransportMode> = {
  PLANE: "plane",
  TRAIN: "train",
  CAR: "car",
};

const TRIP_TYPE_MAP: Record<string, TripType> = {
  ONE_WAY: "oneWay",
  ROUND_TRIP: "roundTrip",
};

const FLIGHT_TYPE_MAP: Record<string, FlightType> = {
  DIRECT: "direct",
  WITH_LAYOVER: "withLayover",
};

const TRAIN_TYPE_MAP: Record<string, TrainTripType> = {
  DIRECT: "direct",
  WITH_CONNECTION: "withConnection",
};

const CAR_TYPE_MAP: Record<string, CarTripFlexibility> = {
  DIRECT: "direct",
  DETOUR_BY_AGREEMENT: "detourByAgreement",
};

const CATEGORY_MAP: Record<string, ParcelCategory> = {
  CLOTHES: "clothes",
  SHOES: "shoes",
  FASHION_ACCESSORIES: "fashionAccessories",
  OTHER_ACCESSORIES: "otherAccessories",
  BOOKS: "books",
  DOCUMENTS: "documents",
  SMALL_TOYS: "smallToys",
  PHONE: "phone",
  COMPUTER: "computer",
  OTHER_ELECTRONICS: "otherElectronics",
  CHECKED_BAG_23KG: "checkedBag23kg",
  CABIN_BAG_12KG: "cabinBag12kg",
};

const TRIP_VERIFICATION_MAP: Record<string, TicketVerificationStatus> = {
  NOT_SUBMITTED: "not_submitted",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

const DOC_STATUS_MAP: Record<string, TicketVerificationStatus> = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

const VALID_LOCATION_KINDS = new Set(["AIRPORT", "TRAIN_STATION", "CITY_AREA"]);
const VALID_LOCATION_FLEX = new Set(["EXACT", "RADIUS", "CITY_WIDE"]);

function toDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T12:00:00`);
}

/**
 * Build a PlaceInfo from raw trip fields.
 * Uses an object literal signature to avoid positional-arg bugs (10 fields).
 * Every field is explicitly `null` (never `undefined`) to match the strict
 * PlaceInfo type.
 */
function buildPlaceInfo(p: {
  label: string | null;
  placeId: string | null;
  city: string | null;
  cityCode: string | null;
  region: string | null;
  regionCode: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
}): PlaceInfo | null {
  if (!p.city && !p.placeId && !p.country) return null;

  return {
    formattedAddress:
      p.label ?? [p.city, p.region, p.country].filter(Boolean).join(", "),
    placeId: p.placeId ?? "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    streetLine1: null,
    city: p.city ?? null,
    cityCode: p.cityCode ?? null,
    region: p.region ?? null,
    regionCode: p.regionCode ?? null,
    postalCode: null,
    country: p.country ?? null,
    countryCode: p.countryCode ?? null,
  };
}

/**
 * Merge server locations with defaults for the transport mode.
 * - For each default card, if a saved location of the same kind exists,
 *   override with the saved data + mark enabled.
 * - Cards without a saved counterpart stay as default (disabled).
 *
 * This preserves the "all cards visible per transport mode" UX, while
 * remembering which were enabled and their previous configuration.
 */
function mergeLocationsWithDefaults(
  serverLocations: any[] | undefined | null,
  defaults: TripLocationPoint[]
): TripLocationPoint[] {
  if (!Array.isArray(serverLocations) || serverLocations.length === 0) {
    // Legacy trip (no saved locations) → return defaults, all disabled.
    // The user can toggle them on in edit mode.
    return defaults;
  }

  // Index saved locations by kind for O(1) lookup
  const savedByKind = new Map<string, any>();
  for (const loc of serverLocations) {
    if (loc?.kind && VALID_LOCATION_KINDS.has(loc.kind)) {
      savedByKind.set(loc.kind, loc);
    }
  }

  return defaults.map((defaultLoc) => {
    const saved = savedByKind.get(defaultLoc.kind);
    if (!saved) return defaultLoc;

    return {
      // Spread default first to preserve `id` and any UI-only fields
      ...defaultLoc,
      details: typeof saved.details === "string" ? saved.details : "",
      flexibility: VALID_LOCATION_FLEX.has(saved.flexibility)
        ? (saved.flexibility as LocationFlexibility)
        : defaultLoc.flexibility,
      radiusKm:
        typeof saved.radiusKm === "number" && saved.radiusKm > 0
          ? saved.radiusKm
          : null,
      enabled: true,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTripToDraft(trip: any): Draft {
  const transportMode = fromSnakeEnum(trip.transportMode, TRANSPORT_MAP);

  const acceptedCategories: ParcelCategory[] = (trip.acceptedCategories ?? [])
    .map((c: string) => CATEGORY_MAP[c])
    .filter(Boolean) as ParcelCategory[];

  const categoryConditions: Partial<Record<ParcelCategory, CategoryCondition>> = {};

  const conditionsArray: any[] = trip.categoryConditions ?? [];
  let useGlobalPrice = false;
  let globalPrice: number | "" = "";

  if (conditionsArray.length > 0) {
    const prices = conditionsArray.map((c: any) =>
      typeof c.priceAmountCents === "number" ? c.priceAmountCents : 0
    );
    const allSame = prices.every((p: number) => p === prices[0]);
    if (allSame) {
      useGlobalPrice = true;
      globalPrice = prices[0] / 100;
    }
  }

  for (const c of conditionsArray) {
    const key = CATEGORY_MAP[c.category] as ParcelCategory | undefined;
    if (!key) continue;

    categoryConditions[key] = {
      categoryKey: key,
      priceAmount: typeof c.priceAmountCents === "number" ? c.priceAmountCents / 100 : "",
    };
  }

  // Map existing uploaded documents
  const tripDocuments: TripDocumentDraft[] = (trip.documents ?? []).map((d: any) => ({
    id: d.id ?? d.fileId,
    fileId: d.fileId,
    url: d.url,
    name: d.originalName ?? "document",
    size: d.sizeBytes ?? 0,
    mimeType: d.mimeType ?? "application/pdf",
    thumbnailUrl: undefined,
    verificationStatus:
      fromSnakeEnum(d.status, DOC_STATUS_MAP) ??
      fromSnakeEnum(d.verificationStatus, DOC_STATUS_MAP) ??
      "pending",
  }));

  // ⭐ Locations: merge server data with the defaults for this transport mode.
  // If transportMode is null (incomplete trip), we use empty defaults.
  const locationDefaults = transportMode
    ? getDefaultLocationsForMode(transportMode)
    : { pickupLocations: [], deliveryLocations: [] };

  return {
    transportMode,
    tripType: fromSnakeEnum(trip.tripType, TRIP_TYPE_MAP) ?? "oneWay",

    from: trip.originLabel ?? trip.originCity ?? "",
    to: trip.destinationLabel ?? trip.destinationCity ?? "",

    fromPlace: buildPlaceInfo({
      label: trip.originLabel ?? null,
      placeId: trip.originPlaceId ?? null,
      city: trip.originCity ?? null,
      cityCode: trip.originCityCode ?? null,
      region: trip.originRegion ?? null,
      regionCode: trip.originRegionCode ?? null,
      country: trip.originCountry ?? null,
      countryCode: trip.originCountryCode ?? null,
      lat: trip.originLat ?? null,
      lng: trip.originLng ?? null,
    }),
    toPlace: buildPlaceInfo({
      label: trip.destinationLabel ?? null,
      placeId: trip.destinationPlaceId ?? null,
      city: trip.destinationCity ?? null,
      cityCode: trip.destinationCityCode ?? null,
      region: trip.destinationRegion ?? null,
      regionCode: trip.destinationRegionCode ?? null,
      country: trip.destinationCountry ?? null,
      countryCode: trip.destinationCountryCode ?? null,
      lat: trip.destinationLat ?? null,
      lng: trip.destinationLng ?? null,
    }),

    departureDate: toDate(trip.departureDateLocal),
    arrivalDate: toDate(trip.arrivalDateLocal),
    departureTime: trip.departureTimeLocal ?? "",
    arrivalTime: trip.arrivalTimeLocal ?? "",

    flightType: fromSnakeEnum(trip.flightType, FLIGHT_TYPE_MAP),
    trainTripType: fromSnakeEnum(trip.trainTripType, TRAIN_TYPE_MAP),
    carTripFlexibility: fromSnakeEnum(trip.carTripFlexibility, CAR_TYPE_MAP),

    flightLayoverCities: (trip.flightLayoverCities ?? []).join(", "),
    trainStopCities: (trip.trainStopCities ?? []).join(", "),
    travelReference: trip.travelReference ?? "",

    tripDocuments,

    acceptedCategories,
    categoryConditions,

    globalPrice,
    useGlobalPrice,

    // ⭐ Locations
    pickupLocations: mergeLocationsWithDefaults(
      trip.pickupLocations,
      locationDefaults.pickupLocations
    ),
    deliveryLocations: mergeLocationsWithDefaults(
      trip.deliveryLocations,
      locationDefaults.deliveryLocations
    ),

    handDeliveryOnly: trip.handDeliveryOnly ?? false,
    instantBooking: trip.instantBooking ?? false,

    ticketVerificationStatus:
      fromSnakeEnum(trip.ticketVerificationStatus, TRIP_VERIFICATION_MAP) ?? "not_submitted",

    currencyCode: "EUR",
    notes: trip.notes ?? "",
  };
}
