import type { Draft } from "./create-trip.types";
import {
  createDefaultFamilyConditions,
  getSmartDefaultDepartureDate,
  getSmartDefaultTime,
} from "./create-trip.config";

export const initialDraft: Draft = {
  transportMode: null,
  tripType: "oneWay",

  from: "",
  to: "",
  fromPlace: null,
  toPlace: null,
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

  // ⭐ Moteur PER_KG — vide tant que le Voyageur n'a pas fixé son prix
  pricePerKg: "",
  capacityKg: "",
  checkedBag23Price: "",
  cabinBag12Price: "",
  familyConditions: createDefaultFamilyConditions(),

  // Populated by getDefaultLocationsForMode() when transportMode is selected.
  pickupLocations: [],
  deliveryLocations: [],

  handDeliveryOnly: false,
  instantBooking: false,
  ticketVerificationStatus: "not_submitted",

  currencyCode: "EUR",
  notes: "",
};
