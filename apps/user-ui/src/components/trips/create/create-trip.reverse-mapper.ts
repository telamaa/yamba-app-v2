/**
 * create-trip.reverse-mapper.ts
 * ==============================
 * Converts a backend Trip object back to a frontend Draft for edit mode.
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
  HandoffMoment,
  PickupMoment,
  TripDocumentDraft,
  TicketVerificationStatus,
} from "./create-trip.types";

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
  WITH_INTERMEDIATE_STOPS: "withIntermediateStops",
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

const HANDOFF_MAP: Record<string, HandoffMoment> = {
  BEFORE_DEPARTURE: "beforeDeparture",
  AT_DEPARTURE: "atDeparture",
};

const PICKUP_MAP: Record<string, PickupMoment> = {
  ON_ARRIVAL: "onArrival",
  LATER_AT_ADDRESS: "laterAtAddress",
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

function toDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T12:00:00`);
}

function buildPlaceInfo(
  label: string | null,
  placeId: string | null,
  city: string | null,
  region: string | null,
  country: string | null,
  lat: number | null,
  lng: number | null
): PlaceInfo | null {
  if (!city && !placeId && !country) return null;

  return {
    formattedAddress: label ?? [city, region, country].filter(Boolean).join(", "),
    placeId: placeId ?? "",
    lat: lat ?? null,
    lng: lng ?? null,
    streetLine1: null,
    city: city ?? null,
    region: region ?? null,
    postalCode: null,
    country: country ?? null,
    countryCode: null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTripToDraft(trip: any): Draft {
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
      handoffMoments: (c.handoffMoments ?? [])
        .map((m: string) => HANDOFF_MAP[m])
        .filter(Boolean) as HandoffMoment[],
      pickupMoments: (c.pickupMoments ?? [])
        .map((m: string) => PICKUP_MAP[m])
        .filter(Boolean) as PickupMoment[],
    };
  }

  // Map existing uploaded documents
  // Note: Prisma field is `status` (TripDocumentStatus). Fall back to `verificationStatus` just in case.
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

  return {
    transportMode: fromSnakeEnum(trip.transportMode, TRANSPORT_MAP),
    tripType: fromSnakeEnum(trip.tripType, TRIP_TYPE_MAP) ?? "oneWay",

    from: trip.originLabel ?? trip.originCity ?? "",
    to: trip.destinationLabel ?? trip.destinationCity ?? "",

    fromPlace: buildPlaceInfo(
      trip.originLabel, trip.originPlaceId, trip.originCity,
      trip.originRegion, trip.originCountry, trip.originLat, trip.originLng
    ),
    toPlace: buildPlaceInfo(
      trip.destinationLabel, trip.destinationPlaceId, trip.destinationCity,
      trip.destinationRegion, trip.destinationCountry, trip.destinationLat, trip.destinationLng
    ),

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

    handDeliveryOnly: trip.handDeliveryOnly ?? false,
    instantBooking: trip.instantBooking ?? false,

    ticketVerificationStatus:
      fromSnakeEnum(trip.ticketVerificationStatus, TRIP_VERIFICATION_MAP) ?? "not_submitted",

    currencyCode: "EUR",
    notes: trip.notes ?? "",
  };
}
