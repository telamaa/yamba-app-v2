/**
 * booking.state.ts
 * ================
 * Initial state + mock TripContext for frontend-only development.
 */

import { getFirstAcceptedFamily } from "./booking.config";
import type { Draft, LocationPoint, TripContext } from "./booking.types";

/** Draft de départ pour un trajet donné : première famille acceptée, poids
 *  mémorisé en recherche (`yamba.search.weightKg`), taille S par défaut. */
export function buildInitialDraft(trip: TripContext): Draft {
  let weightKg = "";
  try {
    const v = Number(window.localStorage.getItem("yamba.search.weightKg"));
    if (Number.isFinite(v) && v >= 0.5 && v <= 30) weightKg = String(v).replace(".", ",");
  } catch {
    /* SSR ou stockage indisponible */
  }
  return {
    ...initialDraft,
    family: getFirstAcceptedFamily(trip),
    // D33 : sans poids mémorisé, on part du colis de référence (2 kg) — jamais un 0 € muet
    weightKg: weightKg || "2",
    // un seul lieu = pré-sélectionné ; plusieurs = le premier, modifiable
    pickupLocationId: trip.pickupOptions[0]?.id ?? null,
    deliveryLocationId: trip.deliveryOptions[0]?.id ?? null,
  };
}

export const initialDraft: Draft = {
  pickupLocationId: null,
  deliveryLocationId: null,
  category: "CLOTHES",
  product: "PARCEL",
  family: "CLOTHES_TEXTILE",
  sizeClass: "S",
  weightKg: "",
  declaredValueEur: "",
  description: "",
  photos: [],
  insurance: "BASIC",

  recipient: {
    firstName: "",
    lastName: "",
    phonePrefix: "+33",
    phoneE164: "",
    email: "",
  },

  charterAccepted: false,
  termsAccepted: false,

};

export const DRAFT_VERSION = 5; // v5 : plus de paymentMethod (un seul Payment Element — B2/A30) // v3 : moteur PER_KG (product / family / sizeClass) — les brouillons v2 sont abandonnés

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

  serviceFeePercent: 0.12,
  pricePerKgCents: 1150,
  remainingKg: 18,
  familyStances: {
    DOCUMENTS_PAPERS: { mode: "ACCEPT", surchargePct: 0 },
    CLOTHES_TEXTILE: { mode: "ACCEPT", surchargePct: 0 },
    FOOD_DRY_SEALED: { mode: "REFUSE", surchargePct: 0 },
    ELECTRONICS_DEVICES: { mode: "SURCHARGE", surchargePct: 20 },
    COSMETICS_CARE: { mode: "ACCEPT", surchargePct: 0 },
    PARTS_TOOLS: { mode: "ACCEPT", surchargePct: 0 },
    TOYS_CHILDCARE: { mode: "ACCEPT", surchargePct: 0 },
    MISC_ACCESSORIES: { mode: "ACCEPT", surchargePct: 0 },
  },
  checkedBag23PriceCents: 23000,
  cabinBag12PriceCents: null,
};
