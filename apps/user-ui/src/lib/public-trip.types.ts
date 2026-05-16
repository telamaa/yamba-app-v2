/**
 * Types pour la page détail publique d'un trip
 *
 * Match exactement le DTO retourné par GET /trips/:id/public
 * (cf. apps/trip-service/src/controllers/trip.controller.ts → getPublicTrip)
 */

export type TransportMode = "PLANE" | "TRAIN" | "CAR";
export type TripType = "ONE_WAY" | "ROUND_TRIP";
export type FlightType = "DIRECT" | "WITH_LAYOVER";
export type TrainTripType = "DIRECT" | "WITH_CONNECTION" | "WITH_INTERMEDIATE_STOPS";
export type CarTripFlexibility = "DIRECT" | "DETOUR_BY_AGREEMENT";
export type TripStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type ParcelCategory =
  | "CLOTHES"
  | "SHOES"
  | "FASHION_ACCESSORIES"
  | "OTHER_ACCESSORIES"
  | "BOOKS"
  | "DOCUMENTS"
  | "SMALL_TOYS"
  | "PHONE"
  | "COMPUTER"
  | "OTHER_ELECTRONICS"
  | "CHECKED_BAG_23KG"
  | "CABIN_BAG_12KG";

/** @deprecated remplacé par les lieux de remise (`pickupLocations`) */
export type CategoryHandoffMoment = "BEFORE_DEPARTURE" | "AT_DEPARTURE";

/** @deprecated remplacé par les lieux de livraison (`deliveryLocations`) */
export type PickupMoment = "ON_ARRIVAL" | "LATER_AT_ADDRESS";

/**
 * Conditions par catégorie acceptée — match le composite type Prisma `TripCategoryCondition`
 */
export type TripCategoryCondition = {
  category: ParcelCategory;
  priceAmountCents: number;
  /** @deprecated remplacé par `pickupLocations` au niveau du trajet */
  handoffMoments?: CategoryHandoffMoment[];
  /** @deprecated remplacé par `deliveryLocations` au niveau du trajet */
  pickupMoments?: PickupMoment[];
};

/* ── Lieux de remise & livraison ─────────────────── */

export type LocationKind = "AIRPORT" | "TRAIN_STATION" | "CITY_AREA";
export type LocationFlexibility = "EXACT" | "RADIUS" | "CITY_WIDE";

/**
 * Un lieu de remise ou de livraison configuré sur un trajet.
 * Le serveur ne retourne que les lieux activés par le carrier.
 */
export type TripLocationPoint = {
  kind: LocationKind;
  details: string | null;
  flexibility: LocationFlexibility;
  radiusKm: number | null;
};

/* ── Reste des types ──────────────────────────────── */

export type TripLocation = {
  label: string | null;
  city: string | null;
  cityCode: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
};

export type TripDates = {
  departureAt: string | null;
  arrivalAt: string | null;
  returnDepartureAt: string | null;
  returnArrivalAt: string | null;
  departureDateLocal: string | null;
  arrivalDateLocal: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
};

export type PublicCarrier = {
  id: string;
  name: string;
  bio: string | null;
  isVerified: boolean;
  isSuperCarrier: boolean;
  ratingsAvg: number;
  ratingsCount: number;
  totalTripsPublished: number;
  totalParcelsCarried: number;
};

export type PublicTripper = {
  id: string;
  publicSlug: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  memberSince: string;
  carrier: PublicCarrier | null;
};

export type PublicTrip = {
  id: string;
  status: TripStatus;
  transportMode: TransportMode | null;
  tripType: TripType;

  origin: TripLocation;
  destination: TripLocation;
  dates: TripDates;

  flightType: FlightType | null;
  trainTripType: TrainTripType | null;
  carTripFlexibility: CarTripFlexibility | null;
  flightLayoverCities: string[];
  trainStopCities: string[];
  travelReference: string | null;

  acceptedCategories: ParcelCategory[];
  categoryConditions: TripCategoryCondition[];

  // ⭐ Lieux de remise & livraison
  pickupLocations: TripLocationPoint[];
  deliveryLocations: TripLocationPoint[];

  handDeliveryOnly: boolean;
  instantBooking: boolean;
  currencyCode: string;
  notes: string | null;

  maxSlots: number | null;
  bookedSlots: number;
  remainingSlots: number | null;

  minPriceCents: number | null;

  ticketVerified: boolean;

  tripper: PublicTripper;

  publishedAt: string | null;
};

export type PublicTripResponse = {
  success: boolean;
  trip: PublicTrip;
};
