/**
 * deal-request.types.ts
 * =====================
 * Types partagés pour l'écran de réception d'une demande de Deal côté Voyageur.
 *
 * Le Voyageur ("CARRIER" en interne, "Tripper" en UI) reçoit une demande
 * de transport (Deal) émise par un Expéditeur. Il a 24h pour l'accepter
 * ou la refuser.
 */

export type DealStatus =
  | "PENDING"          // En attente de réponse du voyageur
  | "ACCEPTED"         // Le voyageur a accepté (= ce qu'on construit après)
  | "DECLINED"         // Le voyageur a refusé
  | "EXPIRED"          // Délai dépassé sans réponse
  | "CANCELLED";       // Annulé par le shipper

export type ParcelCategory =
  | "CLOTHES"
  | "SHOES"
  | "COSMETICS"
  | "BOOKS"
  | "ELECTRONICS_SMALL"
  | "DOCUMENTS"
  | "FOOD_DRY"
  | "GIFTS"
  | "CHECKED_BAG_23KG"
  | "CABIN_BAG_12KG"
  | "OTHER";

export type DealPhotoContext =
  | "DECLARED_CONTENT"   // Tag "Contenu"
  | "DECLARED_PACKAGED"  // Tag "Emballé"
  | "CUSTOM";

export type DealPhoto = {
  id: string;
  url: string;          // URL distante (mock = data URL ou placeholder)
  context: DealPhotoContext;
  label?: string;       // "Contenu" / "Emballé"
};

export type DealShipper = {
  id: string;
  firstName: string;
  lastInitial: string;
  avatarUrl?: string;
  rating: number;
  shipmentCount: number;
  memberSince: string;  // ISO date
  isVerified: boolean;
};

export type DealLocation = {
  id: string;
  type: "AIRPORT" | "STATION" | "ADDRESS" | "POI";
  name: string;
  detail?: string;       // Terminal 2E, Hall principal, etc.
  city: string;
  postalCode?: string;
  flexibilityNote?: string; // "Aminata propose un point de rendez-vous flexible..."
};

export type DealInsurance = "BASIC" | "EXTENDED_500";

export type DealTripContext = {
  tripId: string;
  originCity: string;
  destinationCity: string;
  departureDate: string;     // ISO
  durationHours?: number;
  isDirect: boolean;
};

export type DealEarningsBreakdown = {
  totalPaidByShipper: number;  // Ex 103.75
  yambaCommission: number;     // Ex 12.75 (frais Yamba)
  stripeFees: number;          // Ex 1.70
  netForCarrier: number;       // Ex 89.30
  payoutDelayDays: number;     // Ex 4 (J+4 après livraison)
};

export type DealRequest = {
  id: string;
  status: DealStatus;
  createdAt: string;          // ISO — quand la demande a été émise
  expiresAt: string;          // ISO — deadline pour accepter
  shipper: DealShipper;
  trip: DealTripContext;
  parcel: {
    category: ParcelCategory;
    weightKg: number;
    declaredValueEur: number;
    description: string;
    photos: DealPhoto[];
  };
  pickupLocation: DealLocation;
  deliveryLocation: DealLocation;
  insurance: DealInsurance;
  earnings: DealEarningsBreakdown;
};

// ────────────────────────────────────────────────────────────
// Décline UX
// ────────────────────────────────────────────────────────────

export type DeclineReason =
  | "CATEGORY_NOT_TRANSPORTED"
  | "WEIGHT_TOO_HEAVY"
  | "LOCATION_INCOMPATIBLE"
  | "TIMING_TOO_TIGHT"
  | "OTHER";

export type DeclinePayload = {
  reason?: DeclineReason;
  details?: string;
};

export type AcceptPayload = {
  charterAccepted: boolean;
};

// ────────────────────────────────────────────────────────────
// Countdown
// ────────────────────────────────────────────────────────────

export type ExpiryStatus = {
  hoursLeft: number;
  minutesLeft: number;
  isExpired: boolean;
  isUrgent: boolean;          // < 2h restantes
  totalMinutesLeft: number;
};
