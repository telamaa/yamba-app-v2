/**
 * booking.state.ts
 * ================
 * Initial state + mock TripContext for frontend-only development.
 */

import type { Draft, LocationPoint, TripContext } from "./booking.types";

export const initialDraft: Draft = {
  pickupLocationId: null,
  deliveryLocationId: null,
  category: "CLOTHES",
  weightKg: "",
  declaredValueEur: "",
  description: "",
  photos: [],
  insurance: "BASIC",

  recipient: {
    firstName: "",
    lastName: "",
    phoneE164: "",
    email: "",
  },

  charterAccepted: false,
  termsAccepted: false,

  paymentMethod: "CARD",
};

export const DRAFT_VERSION = 2; // bumped because the trip shape changed

// ============================================================
// MOCK TRIP
// ============================================================

export const mockPickupOptions: LocationPoint[] = [
  {
    id: "pk-1",
    kind: "AIRPORT",
    label: "Aéroport Paris-CDG",
    subLabel: "Terminal 2E",
    addressShort: "95700 Roissy-en-France",
    city: "Roissy-en-France",
    countryCode: "FR",
  },
  {
    id: "pk-2",
    kind: "TRAIN_STATION",
    label: "Gare du Nord",
    subLabel: "Hall principal",
    addressShort: "75010 Paris",
    city: "Paris",
    countryCode: "FR",
  },
];

export const mockDeliveryOptions: LocationPoint[] = [
  {
    id: "dl-1",
    kind: "AIRPORT",
    label: "Aéroport Maya-Maya",
    subLabel: "Hall arrivées",
    addressShort: "Brazzaville",
    city: "Brazzaville",
    countryCode: "CG",
  },
  {
    id: "dl-2",
    kind: "ADDRESS",
    label: "Marché Total",
    subLabel: "Quartier Bacongo",
    addressShort: "Avenue Foch, Brazzaville",
    city: "Brazzaville",
    countryCode: "CG",
  },
];

export const mockTrip: TripContext = {
  tripId: "trip-mock-001",
  carrier: {
    id: "user-thomas",
    firstName: "Thomas",
    lastInitial: "M",
    rating: 4.9,
    dealCount: 23,
  },
  originCity: "Paris",
  destinationCity: "Brazzaville",
  originCountry: "FR",
  destinationCountry: "CG",
  departureDate: "2026-05-28T14:00:00Z",
  travelMode: "PLANE",
  isDirect: true,
  durationHours: 8,
  pickupOptions: mockPickupOptions,
  deliveryOptions: mockDeliveryOptions,

  // Only the categories the carrier accepts on this trip
  acceptedCategories: [
    "CLOTHES",
    "SHOES",
    "DOCUMENTS",
    "BOOKS",
    "SMALL_TOYS",
    "CHECKED_BAG_23KG",
  ],

  // Per-category transport price (EUR)
  categoryPrices: {
    CLOTHES: 50,
    SHOES: 50,
    DOCUMENTS: 40,
    BOOKS: 45,
    SMALL_TOYS: 50,
    CHECKED_BAG_23KG: 85,
  },

  serviceFeePercent: 0.15,
};
