/**
 * deal.types.ts
 * =============
 * Types partagés pour le module Deal côté Voyageur (toutes vues confondues :
 * request, accepted, pickup, tracking, etc.).
 *
 * Le Voyageur ("CARRIER" en interne, "Tripper" en UI) reçoit une demande
 * de transport (Deal) émise par un Expéditeur. Il a 24h pour l'accepter
 * ou la refuser.
 */

export type DealStatus =
  | "PENDING"          // En attente de réponse du voyageur
  | "ACCEPTED"         // Le voyageur a accepté
  | "PICKED_UP"        // Colis pris en charge, voyage en cours
  | "DELIVERED"        // Code validé à l'arrivée, livraison faite
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
  | "DECLARED_CONTENT"   // Tag "Contenu" (déclaration Shipper, violet)
  | "DECLARED_PACKAGED"  // Tag "Emballé" (déclaration Shipper, violet)
  | "PICKUP_CONTENT"     // Photo Voyageur au pickup (amber)
  | "PICKUP_PACKAGED"    // Photo Voyageur au pickup (amber)
  | "PICKUP_OTHER"       // Photo Voyageur au pickup (amber)
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
  // ✨ Suivi du voyage (présents dès PICKED_UP)
  pickup?: DealPickupInfo;
  recipient?: DealRecipient;
  trackingEvents?: DealTrackingEvent[];
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

// ============================================================
// Pickup (prise en charge du colis) — feat/pickup-confirmation
// ============================================================

/** Les 5 points de vérification obligatoires avant confirmation */
export type PickupChecklistItemId =
  | "CONTENT_MATCHES"
  | "WEIGHT_OK"
  | "NO_FORBIDDEN"
  | "PACKAGING_OK"
  | "ITEMS_IDENTIFIED";

/** Photo prise par le Voyageur au pickup (preview locale réelle ; upload R2 en PR backend) */
export type PickupPhotoDraft = {
  id: string;
  context: "PICKUP_CONTENT" | "PICKUP_PACKAGED" | "PICKUP_OTHER";
  label?: string;
  previewUrl?: string;
  file?: File; // le fichier réel, envoyé vers R2 dans la PR backend
};

export type ConfirmPickupPayload = {
  checklist: PickupChecklistItemId[];
  photos: PickupPhotoDraft[];
  notes?: string;
};

export type PickupRefuseReason =
  | "CONTENT_MISMATCH"
  | "SUSPICIOUS_CONTENT"
  | "OVERWEIGHT"
  | "BAD_PACKAGING"
  | "OTHER";

export type RefusePickupPayload = {
  reason?: PickupRefuseReason;
  details?: string;
};

// ============================================================
// Suivi du voyage (vue PICKED_UP Voyageur) — feat/delivery-code-entry
// ============================================================

/** Événements de suivi optionnels que le Voyageur peut déclencher (philosophie A+B) */
export type DealTrackingEventId =
  | "AT_AIRPORT"
  | "FLIGHT_DEPARTED"
  | "FLIGHT_ARRIVED";

export type DealTrackingEvent = {
  id: DealTrackingEventId;
  at: string; // ISO — moment où le Voyageur a confirmé l'événement
};

/** Infos de pickup confirmé (miroir de BookingPickupInfo côté Sender) */
export type DealPickupInfo = {
  pickedUpAt: string;
  locationName: string;
  photos: DealPhoto[]; // photos prises par le Voyageur (context PICKUP_*)
  notes?: string;
};

/** Destinataire (révélé au Voyageur après pickup — il doit la contacter à l'arrivée) */
export type DealRecipient = {
  firstName: string;
  lastName: string;
  city: string;
  phone: string; // ex "+242 06 421 88 12"
};
