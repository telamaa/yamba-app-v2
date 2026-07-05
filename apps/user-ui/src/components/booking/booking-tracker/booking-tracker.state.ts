/**
 * booking-tracker.state.ts
 * ========================
 * Mock data pour le développement et les tests visuels.
 * - mockBookingAccepted : statut ACCEPTED (code en attente)
 * - mockBookingPickedUp : statut PICKED_UP (code révélé)
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

export const mockBookingPickedUp: Booking = {
  ...mockBookingAccepted,
  id: "booking_mock_picked",
  status: "PICKED_UP",

  deliveryCode: {
    status: "AVAILABLE",
    code: "742891",
    regeneratedCount: 0,
  },

  pickup: {
    pickedUpAt: new Date(now - 20 * 60 * 1000).toISOString(),
    locationName: "CDG Terminal 2E",
    photos: [
      {
        id: "pickup_photo_1",
        url: "/mock/pickup-content.jpg",
        context: "PICKUP_CONTENT",
        label: "Contenu",
      },
      {
        id: "pickup_photo_2",
        url: "/mock/pickup-packaged.jpg",
        context: "PICKUP_PACKAGED",
        label: "Emballé",
      },
    ],
  },
};

/**
 * Mock Booking en statut DELIVERED : Thomas a validé le code hier à 22h27.
 * Période de vérification en cours — versement automatique à J+4.
 */
export const mockBookingDelivered: Booking = {
  ...mockBookingPickedUp,
  id: "booking_mock_delivered",
  status: "DELIVERED",

  deliveryCode: {
    status: "VALIDATED",
    code: "742891",
    regeneratedCount: 0,
  },

  delivery: {
    deliveredAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(), // hier ~22h
    validatedBy: "CODE",
  },
};

/**
 * Mock Booking PICKED_UP en cours de voyage (écran 6) :
 * Thomas a confirmé son arrivée à l'aéroport puis le décollage.
 * Le vol atterrit dans ~5h. Aminata suit.
 */
export const mockBookingInTransit: Booking = {
  ...mockBookingPickedUp,
  id: "booking_mock_transit",

  // Vol parti il y a ~3h, durée 8h → arrivée dans ~5h (stable à chaque reload)
  trip: {
    ...mockBookingPickedUp.trip,
    departureDate: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },

  pickup: {
    ...mockBookingPickedUp.pickup!,
    pickedUpAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  },

  trackingEvents: [
    {
      id: "AT_AIRPORT",
      at: new Date(now - 3.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "FLIGHT_DEPARTED",
      at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

