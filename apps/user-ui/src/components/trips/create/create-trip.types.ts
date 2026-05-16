export type Step = 1 | 2 | 3;

export type TransportMode = "plane" | "train" | "car";
export type TripType = "oneWay" | "roundTrip";

export type FlightType = "direct" | "withLayover";
export type TrainTripType = "direct" | "withConnection";
export type CarTripFlexibility = "direct" | "detourByAgreement";

export type TicketVerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected";

export type ParcelCategory =
  | "clothes"
  | "shoes"
  | "fashionAccessories"
  | "otherAccessories"
  | "books"
  | "documents"
  | "smallToys"
  | "phone"
  | "computer"
  | "otherElectronics"
  | "checkedBag23kg"
  | "cabinBag12kg";

/**
 * Simplified: no more handoff/pickup moments at category level.
 * Logistics flexibility is now defined at trip level via TripLocationPoint.
 */
export type CategoryCondition = {
  categoryKey: ParcelCategory;
  priceAmount: number | "";
};

export type TripDocumentDraft = {
  id: string;
  fileId: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  verificationStatus?: TicketVerificationStatus;
};

/**
 * Snapshot Google Places — données structurées pour un lieu.
 *
 * IMPORTANT: doit rester compatible avec `PlaceDetails` exporté par
 * `@/components/search/CityAutocomplete`. C'est la même structure.
 */
export type PlaceInfo = {
  formattedAddress: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  streetLine1: string | null;

  // Display text (locale-dependent) — UI uniquement
  city: string | null;
  region: string | null;
  country: string | null;

  // ISO codes (universal) — pour la logique métier
  cityCode: string | null;       // IATA (CDG, JFK) si dispo
  regionCode: string | null;     // ISO 3166-2 (ex: "FR-IDF")
  countryCode: string | null;    // ISO 3166-1 alpha-2 (ex: "FR")

  postalCode: string | null;
};

/* ── Trip location points ─────────────────────────────────────────────
 * The Voyageur defines where the Expéditeur can drop off (PICKUP) and
 * where they can recover the parcel (DELIVERY) for THIS trip.
 *
 * Stored as arrays at Draft level to allow future expansion
 * (multi-city, multi-airport, etc.). The UI presents them as fixed
 * cards (Airport + CityArea, or just CityArea for cars) — disabled
 * cards stay in the array with `enabled: false` for state stability.
 * ──────────────────────────────────────────────────────────────────── */

export type LocationContext = "PICKUP" | "DELIVERY";
export type LocationKind = "AIRPORT" | "TRAIN_STATION" | "CITY_AREA";
export type LocationFlexibility = "EXACT" | "RADIUS" | "CITY_WIDE";

export type TripLocationPoint = {
  id: string;                       // local React key; backend assigns ObjectId
  context: LocationContext;
  kind: LocationKind;
  enabled: boolean;                 // UX state — only enabled ones sent to API
  details: string;                  // free text ("T2E hall départ", "Café de la gare")
  flexibility: LocationFlexibility;
  radiusKm: number | null;          // only set when flexibility === "RADIUS"
};

export type Draft = {
  transportMode: TransportMode | null;
  tripType: TripType;

  from: string;
  to: string;
  fromPlace: PlaceInfo | null;
  toPlace: PlaceInfo | null;
  departureDate?: Date;
  arrivalDate?: Date;
  departureTime: string;
  arrivalTime: string;

  flightType: FlightType | null;
  trainTripType: TrainTripType | null;
  carTripFlexibility: CarTripFlexibility | null;

  flightLayoverCities: string;
  trainStopCities: string;
  travelReference: string;

  tripDocuments: TripDocumentDraft[];

  acceptedCategories: ParcelCategory[];
  categoryConditions: Partial<Record<ParcelCategory, CategoryCondition>>;

  globalPrice: number | "";
  useGlobalPrice: boolean;

  // NEW — locations per context (Voyageur defines, Expéditeur adapts)
  pickupLocations: TripLocationPoint[];
  deliveryLocations: TripLocationPoint[];

  handDeliveryOnly: boolean;
  instantBooking: boolean;

  ticketVerificationStatus: TicketVerificationStatus;

  currencyCode: "EUR";
  notes: string;
};

export type MobileScreen =
  | null
  | "from"
  | "to"
  | "date"
  | "arrivalDate"
  | "pathType"
  | "categories";

export type CategoryOption = {
  key: ParcelCategory;
  label: string;
};

export type CreateTripCopy = {
  title: string;
  subtitle: string;
  firstTripTitle: string;
  firstTripSub: string;
  steps: string[];
  back: string;
  continue: string;
  saveDraft: string;
  publish: string;
  summary: string;
  close: string;
  emptyValue: string;

  step1Title: string;
  step1Sub: string;
  step2Title: string;
  step2Sub: string;
  step3Title: string;
  step3Sub: string;

  plane: string;
  train: string;
  car: string;
  oneWay: string;
  roundTrip: string;

  from: string;
  to: string;
  date: string;
  arrivalDate: string;
  departureTime: string;
  arrivalTime: string;
  swap: string;

  tripPathType: string;
  directFlight: string;
  withLayover: string;
  directTrain: string;
  withConnection: string;
  directTrip: string;
  detourByAgreement: string;

  flightLayoverCities: string;
  trainStopCities: string;
  travelReference: string;

  docUpload: string;
  docUploadSub: string;
  docUploadHint: string;
  docPending: string;
  docVerified: string;
  docCount: string;

  categories: string;
  globalPrice: string;
  globalPriceSub: string;
  adjustPrices: string;
  pricePerCategory: string;
  price: string;

  // Locations
  pickupLocations: string;
  pickupLocationsSub: string;
  deliveryLocations: string;
  deliveryLocationsSub: string;
  atAirport: string;
  atTrainStation: string;
  inTheCity: string;
  locationDetailsPlaceholder: string;
  flexibility: string;
  flexExact: string;
  flexRadius5: string;
  flexRadius10: string;
  flexRadius15: string;
  flexRadius20: string;
  flexCityWide: string;
  locationsCount: (n: number) => string;

  options: string;
  handOnly: string;
  instantBooking: string;

  notes: string;
  notesPlaceholder: string;

  reviewMode: string;
  reviewRoute: string;
  reviewSchedule: string;
  reviewCategoryConditions: string;
  reviewLocations: string;
  reviewDocuments: string;
  edit: string;

  publicPreview: string;
  asSeenByShippers: string;

  revenueEstimate: string;
  resumeDraft: string;
  resumeDraftSub: string;
  startFresh: string;
  popularRoute: string;
  almostDone: string;
  almostDoneSub: string;
  stayAndFinish: string;
  leave: string;
};
