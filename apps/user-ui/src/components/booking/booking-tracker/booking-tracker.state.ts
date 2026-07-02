/**
 * booking-tracker.state.ts
 * ========================
 * Mock data pour le développement et les tests visuels.
 * À remplacer par un vrai fetch via le gateway dans la PR backend.
 */

import type { Booking } from "./booking-tracker.types";

const now = Date.now();

export const mockBookingAccepted: Booking = {
  id: "booking_mock_001",
  status: "ACCEPTED",
  createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  acceptedAt: new Date(now - 30 * 60 * 1000).toISOString(),

  carrier: {
    id: "user_thomas",
    firstName: "Thomas",
    lastInitial: "M",
    rating: 4.9,
    dealCount: 23,
    isVerified: true,
  },

  trip: {
    tripId: "trip_paris_brazza_001",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    departureDate: "2026-05-28T14:00:00Z",
    durationHours: 8,
    isDirect: true,
  },

  parcel: {
    category: "CLOTHES",
    weightKg: 2.5,
    declaredValueEur: 150,
    description: "3 t-shirts, 1 pull, du chocolat français",
    photos: [
      {
        id: "photo_1",
        url: "/mock/parcel-content.jpg",
        context: "DECLARED_CONTENT",
        label: "Contenu",
      },
      {
        id: "photo_2",
        url: "/mock/parcel-packaged.jpg",
        context: "DECLARED_PACKAGED",
        label: "Emballé",
      },
    ],
  },

  pickupLocation: {
    id: "loc_pickup_paris",
    type: "AIRPORT",
    name: "À l'aéroport CDG · Terminal 2E",
    city: "Paris",
    detail: "Hall des départs · le jour du vol",
  },

  recipient: {
    firstName: "Marie",
    lastName: "Mboungou",
    city: "Brazzaville",
  },

  insurance: "EXTENDED_500",

  payment: {
    totalPaidEur: 103.75,
    cardBrand: "Visa",
    cardLast4: "4242",
    statementDescriptor: "YAMBA*COLIS",
    paymentMethod: "CARD",
  },

  deliveryCode: {
    status: "PENDING",
    regeneratedCount: 0,
  },
};
