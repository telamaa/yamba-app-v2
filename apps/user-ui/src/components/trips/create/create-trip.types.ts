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

/* ── Moteur PER_KG (D13/D14, A28) ─────────────────────────────────────
 * Miroir front de `@packages/api-contracts` trip-pricing.schema.ts :
 * 8 familles de risque FIGÉES (CAT-02) + position du Voyageur par famille.
 * La famille répond à « qu'est-ce que c'est ? » — plus jamais au prix.
 * ──────────────────────────────────────────────────────────────────── */

export type ParcelFamily =
  | "DOCUMENTS_PAPERS"
  | "CLOTHES_TEXTILE"
  | "FOOD_DRY_SEALED"
  | "ELECTRONICS_DEVICES"
  | "COSMETICS_CARE"
  | "PARTS_TOOLS"
  | "TOYS_CHILDCARE"
  | "MISC_ACCESSORIES";

export type FamilyConditionMode = "ACCEPT" | "SURCHARGE" | "REFUSE";

/** État UI d'une famille : le % est conservé même hors mode SURCHARGE
 *  (mémoire du curseur) — seul le mapper décide de l'envoyer. */
export type FamilyConditionDraft = {
  mode: FamilyConditionMode;
  surchargePct: number;
};

/**
 * @deprecated moteur PER_CATEGORY (legacy) — conservé pour l'édition des
 * trajets existants jusqu'à la PR cleanup post-refonte (A28).
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

  /** @deprecated legacy PER_CATEGORY — plus saisi par le formulaire, relu en édition */
  acceptedCategories: ParcelCategory[];
  /** @deprecated legacy PER_CATEGORY */
  categoryConditions: Partial<Record<ParcelCategory, CategoryCondition>>;
  /** @deprecated legacy PER_CATEGORY */
  globalPrice: number | "";
  /** @deprecated legacy PER_CATEGORY */
  useGlobalPrice: boolean;

  // ⭐ Moteur PER_KG (D13) — montants en EUROS côté Draft, cents dans le payload
  pricePerKg: number | "";
  capacityKg: number | "";
  checkedBag23Price: number | "";
  cabinBag12Price: number | "";
  familyConditions: Record<ParcelFamily, FamilyConditionDraft>;

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

  // ── Pricing PER_KG (D13/D14/D15/D19) ──
  pricePerKg: string;
  pricePerKgSub: string;
  capacity: string;
  capacitySub: string;
  capacityTolerance: string;
  fairPriceOk: string;
  fairPriceLow: string;
  fairPriceHigh: string;
  priceAnchor: (median: string, low: string, high: string) => string;
  gaugeLow: string;
  gaugeMedian: string;
  gaugeHigh: string;
  families: string;
  familiesSub: string;
  familyAccept: string;
  familySurcharge: string;
  familyRefuse: string;
  bags: string;
  bagsSub: string;
  checkedBag23: string;
  cabinBag12: string;
  bagConsumes: (kg: number) => string;
  netGain: string;
  netGainIfFull: (kg: number) => string;
  netGainSub: string;
  yourOffer: string;
  whyThisPrice: string;
  factorBase: (v: string, corridor: string) => string;
  zoneLabel: (zone: string) => string;
  factorDirectFlight: string;
  factorDepartureSoon: string;
  minParcelPrice: (min: number) => string;
  priceHint: string;
  capacityHint: string;
  familiesHint: string;
  bagsHint: string;
  familiesAllAccepted: string;
  accepted: string;
  refused: string;
  addSurcharge: string;
  surchargeLabel: string;
  removeSurcharge: string;
  adjust: string;
  add: string;
  bagsNone: string;
  bagsSummary: (n: number) => string;
  bagNeedsCapacity: (kg: number) => string;
  bagEquivalent: (v: string) => string;
  netGainTitle: (kg: number) => string;
  netGainPaid: string;
  optionsAndMessage: string;
  responseWithin24h: string;
  surchargeShort: (pct: number) => string;
  reviewPricing: string;
  perKgUnit: string;
  kgUnit: string;
  availableKg: (kg: number) => string;
  refusedFamilies: string;

  /** @deprecated legacy */
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
  /** @deprecated legacy */
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
