import type { Draft } from "./create-trip.types";

export const initialDraft: Draft = {
  transportMode: null,
  tripType: "oneWay",

  from: "",
  to: "",
  departureDate: undefined,
  arrivalDate: undefined,
  departureTime: "",
  arrivalTime: "",

  flightType: null,
  trainTripType: null,
  carTripFlexibility: null,

  flightLayoverCities: "",
  trainStopCities: "",
  travelReference: "",

  acceptedCategories: [],
  categoryConditions: {},

  handDeliveryOnly: false,
  instantBooking: false,
  ticketVerificationStatus: "not_submitted",

  currencyCode: "EUR",
  notes: "",

  /**
   * Legacy
   */
  stopoverCount: 0,
  detourRadiusKm: undefined,
  transportReference: "",
  maxParcelCount: "",
  maxWeightKg: "",
  volumeSize: null,
  fragileItemsAllowed: false,
  urgentDocumentsAllowed: false,
  handoffFlexibility: null,
  priceAmount: "",
};
