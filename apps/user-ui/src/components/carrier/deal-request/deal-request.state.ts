/**
 * deal-request.state.ts
 * =====================
 * Mock data pour le développement et les tests visuels.
 * À remplacer par un vrai fetch via le gateway dans la PR backend.
 */

import type { DealRequest } from "./deal-request.types";

// Date d'expiration mock = 22h dans le futur (pour voir le countdown)
const expiresInMs = 22 * 60 * 60 * 1000;
const now = Date.now();

export const mockDealRequest: DealRequest = {
  id: "deal_mock_001",
  status: "PENDING",
  createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  expiresAt: new Date(now + expiresInMs).toISOString(),

  shipper: {
    id: "user_aminata",
    firstName: "Aminata",
    lastInitial: "T",
    rating: 4.8,
    shipmentCount: 12,
    memberSince: "2024-11-15T00:00:00Z",
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
    description: "3 t-shirts, 1 pull, du chocolat français pour ma famille à Brazzaville",
    photos: [
      {
        id: "photo_1",
        url: "/mock/parcel-content.jpg", // Placeholder
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
    type: "POI",
    name: "Paris 18e — proche métro Marx Dormoy",
    city: "Paris",
    postalCode: "75018",
    flexibilityNote:
      "Aminata propose un point de rendez-vous flexible avant ton départ",
  },

  deliveryLocation: {
    id: "loc_delivery_brazza",
    type: "ADDRESS",
    name: "Marie Mboungou",
    detail: "Téléphone communiqué après acceptation · code de livraison à 6 chiffres",
    city: "Brazzaville",
  },

  insurance: "EXTENDED_500",

  earnings: {
    totalPaidByShipper: 103.75,
    yambaCommission: 12.75,
    stripeFees: 1.7,
    netForCarrier: 89.3,
    payoutDelayDays: 4,
  },
};
