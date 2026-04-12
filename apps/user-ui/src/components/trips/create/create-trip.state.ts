import type { Draft } from "./create-trip.types";
import { getSmartDefaultDepartureDate, getSmartDefaultTime } from "./create-trip.config";

export const initialDraft: Draft = {
  transportMode: null,
  tripType: "oneWay",

  from: "",
  to: "",
  departureDate: getSmartDefaultDepartureDate(),
  arrivalDate: undefined,
  departureTime: getSmartDefaultTime(),
  arrivalTime: "",

  flightType: null,
  trainTripType: null,
  carTripFlexibility: null,

  flightLayoverCities: "",
  trainStopCities: "",
  travelReference: "",

  tripDocuments: [],

  acceptedCategories: [],
  categoryConditions: {},

  globalPrice: "",
  useGlobalPrice: true,

  handDeliveryOnly: false,
  instantBooking: false,
  ticketVerificationStatus: "not_submitted",

  currencyCode: "EUR",
  notes: "",
};
