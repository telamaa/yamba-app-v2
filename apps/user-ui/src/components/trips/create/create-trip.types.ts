export type Step = 1 | 2 | 3;

export type TransportMode = "plane" | "train" | "car";
export type TripType = "oneWay" | "roundTrip";

export type FlightType = "direct" | "withLayover";
export type TrainTripType = "direct" | "withConnection" | "withIntermediateStops";
export type CarTripFlexibility = "direct" | "detourByAgreement";

/**
 * Legacy conservé temporairement pour éviter de casser d'autres composants
 * non encore patchés.
 */
export type ParcelVolume = "small" | "medium" | "large";

export type HandoffMoment = "beforeDeparture" | "atDeparture";
export type PickupMoment = "onArrival" | "laterAtAddress";

export type TicketVerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected";

/**
 * Legacy conservé temporairement pour compatibilité partielle.
 */
export type HandoffFlexibility = "flexible" | "fixedTime" | "byAppointment";

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

export type MobileScreen =
  | null
  | "from"
  | "to"
  | "date"
  | "arrivalDate"
  | "pathType"
  | "categories";

export type CategoryCondition = {
  categoryKey: ParcelCategory;
  priceAmount: number | "";
  handoffMoments: HandoffMoment[];
  pickupMoments: PickupMoment[];
};

export type Draft = {
  transportMode: TransportMode | null;
  tripType: TripType;

  from: string;
  to: string;
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

  acceptedCategories: ParcelCategory[];
  categoryConditions: Partial<Record<ParcelCategory, CategoryCondition>>;

  handDeliveryOnly: boolean;
  instantBooking: boolean;

  /**
   * Statut système, non saisi par l'utilisateur.
   */
  ticketVerificationStatus: TicketVerificationStatus;

  currencyCode: "EUR";
  notes: string;

  /**
   * Legacy conservé temporairement pour compatibilité avec d'autres composants.
   */
  stopoverCount?: number;
  detourRadiusKm?: number;
  transportReference?: string;

  maxParcelCount?: number | "";
  maxWeightKg?: number | "";
  volumeSize?: ParcelVolume | null;

  fragileItemsAllowed?: boolean;
  urgentDocumentsAllowed?: boolean;

  handoffFlexibility?: HandoffFlexibility | null;
  priceAmount?: number | "";

  /**
   * Legacy éventuel
   */
  ticketVerified?: boolean;
};

export type CreateTripCopy = {
  title: string;
  subtitle: string;
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

  tripPathType: string;
  directFlight: string;
  withLayover: string;
  directTrain: string;
  withConnection: string;
  withIntermediateStops: string;
  directTrip: string;
  detourByAgreement: string;

  flightLayoverCities: string;
  trainStopCities: string;
  travelReference: string;

  categories: string;
  openCategories: string;

  price: string;
  handoffMoments: string;
  pickupMoments: string;
  beforeDeparture: string;
  atDeparture: string;
  onArrival: string;
  laterAtAddress: string;
  pickupInfo: string;

  options: string;
  handOnly: string;
  instantBooking: string;

  notes: string;
  notesPlaceholder: string;
  uploadTitle: string;
  uploadSub: string;

  reviewMode: string;
  reviewRoute: string;
  reviewSchedule: string;
  reviewCategoryConditions: string;

  /**
   * Legacy conservé temporairement.
   */
  smallDetourPossible?: string;
  stopoverCount?: string;
  detourRadius?: string;
  transportReference?: string;
  maxParcelCount?: string;
  maxWeight?: string;
  volume?: string;
  small?: string;
  medium?: string;
  large?: string;
  constraints?: string;
  fragile?: string;
  urgentDocs?: string;
  handoffFlexibility?: string;
  duringTrip?: string;
  flexible?: string;
  fixedTime?: string;
  byAppointment?: string;
  reviewCapacity?: string;
  reviewConditions?: string;
  ticketVerified?: string;
};

export type CategoryOption = {
  key: ParcelCategory;
  label: string;
};
