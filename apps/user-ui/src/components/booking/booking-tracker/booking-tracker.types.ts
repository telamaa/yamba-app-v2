/**
 * booking-tracker.types.ts
 * ========================
 * Types partagés pour le module BookingTracker côté Expéditeur (Shipper).
 *
 * Le Booking représente la réservation côté Sender. Il évolue selon le
 * statut du Deal côté Voyageur, mais avec son propre vocabulaire et ses
 * propres états visibles côté Sender.
 */

export type BookingStatus =
  | "AWAITING_CARRIER" // Booking créé, en attente qu'un Voyageur accepte
  | "ACCEPTED" // Un Voyageur a accepté (Phase 3 actuelle)
  | "PICKED_UP" // Voyageur a confirmé pickup, code livraison révélé
  | "IN_TRANSIT" // Colis en transport
  | "DELIVERED" // Code validé par le Voyageur à l'arrivée
  | "VERIFIED" // Période de vérification 3j écoulée, payout libéré
  | "DISPUTED" // Sender a signalé un problème
  | "CANCELLED";

export type BookingCarrier = {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  dealCount: number;
  isVerified: boolean;
  avatarUrl?: string;
};

export type BookingTrip = {
  tripId: string;
  originCity: string;
  destinationCity: string;
  departureDate: string; // ISO
  durationHours?: number;
  isDirect?: boolean;
};

export type BookingParcel = {
  category: string;
  weightKg: number;
  declaredValueEur: number;
  description: string;
  photos: BookingPhoto[];
};

export type BookingPhoto = {
  id: string;
  url: string;
  context: "DECLARED_CONTENT" | "DECLARED_PACKAGED";
  label?: string;
};

export type BookingLocation = {
  id: string;
  type: "AIRPORT" | "STATION" | "ADDRESS" | "POI";
  name: string;
  city?: string;
  detail?: string;
};

export type BookingRecipient = {
  firstName: string;
  lastName: string;
  city: string;
  // Pas de téléphone côté Sender : c'est elle qui le saisit, donc le connaît déjà
};

export type BookingInsurance = "BASIC" | "EXTENDED_500";

export type BookingPayment = {
  totalPaidEur: number;
  cardBrand: string; // "Visa", "Mastercard", ...
  cardLast4: string; // "4242"
  statementDescriptor: string; // "YAMBA*COLIS"
  paymentMethod: "CARD"; // pourra évoluer
};

export type BookingDeliveryCode = {
  status: "PENDING" | "AVAILABLE" | "REVEALED" | "VALIDATED" | "EXPIRED";
  // code seulement présent si status >= AVAILABLE
  code?: string;
  // Combien de fois le Sender l'a régénéré (max 5)
  regeneratedCount?: number;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  createdAt: string;
  acceptedAt?: string;

  carrier: BookingCarrier;
  trip: BookingTrip;
  parcel: BookingParcel;
  pickupLocation: BookingLocation;
  recipient: BookingRecipient;
  insurance: BookingInsurance;

  payment: BookingPayment;
  deliveryCode: BookingDeliveryCode;
};
