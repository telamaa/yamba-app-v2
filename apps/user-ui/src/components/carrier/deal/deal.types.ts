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
  | "COMPLETED"        // Fenêtre J+4 close, paiement libéré
  | "DISPUTED"         // Litige ouvert pendant la vérification
  | "DECLINED"         // Le voyageur a refusé
  | "EXPIRED"          // Délai dépassé sans réponse
  | "CANCELLED";       // Annulé par le shipper (ou SYSTEM — D40)

// fix baseline : source de vérité unique — l'union locale dupliquait
// l'enum avec un vocabulaire fantôme (COSMETICS, ELECTRONICS_SMALL,
// FOOD_DRY, GIFTS, OTHER) absent du produit et des JSON i18n.
// trips.types.ts importe déjà depuis booking.types ; on aligne.
export type { ParcelCategory } from "@/components/booking/booking.types";
import type { ParcelCategory } from "@/components/booking/booking.types";

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
  /** Slug du profil public (/u/[slug]) — absent = pas de lien « Voir profil » (A45). */
  publicSlug?: string;
  // Stats de confiance : absentes de BookingCounterpart (l'API réelle) —
  // l'UI les masque quand elles manquent. Reviendront avec le profil
  // public enrichi (B5 notation).
  rating?: number;
  shipmentCount?: number;
  memberSince?: string; // ISO date
  isVerified?: boolean;
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
  durationHours?: number;    // absent du snapshot réel (mock seulement)
  isDirect?: boolean;
};

// A13 : la vue Carrier n'expose NI la commission NI le total payé par
// l'Expéditeur (CarrierPricing = gains seulement). L'ancien détail
// totalPaidByShipper/yambaCommission/stripeFees venait du mock et
// violait cette frontière — supprimé au branchement réel.
export type DealEarningsBreakdown = {
  netForCarrier: number;       // Ex 89.30 (transportCents / 100)
  payoutDelayDays: number;     // Ex 4 (J+4 après livraison)
};

export type DealRequest = {
  id: string;
  status: DealStatus;
  /** Actions permises par la machine d'état serveur — le front reflète,
   *  ne décide jamais. Absent sur les vieux mocks (fallback par statut). */
  allowedActions?: readonly string[];
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
  /** Compteur SERVEUR de la saisie du code (vue Carrier — A38) : essais restants et verrou. */
  deliveryAttemptsLeft?: number;
  deliveryLockedUntil?: string;
  recipient?: DealRecipient;
  trackingEvents?: DealTrackingEvent[];

  // ✨ B4-PR3 — après la remise (A75–A78) : le front reflète, ne décide jamais.
  deliveredAt?: string;
  /** Fin de la fenêtre de vérification de l'Expéditeur (J+4) — servie. */
  payoutDueAt?: string;
  /** Photos optionnelles prises à la remise (A76). */
  deliveryPhotos: DealPhoto[];
  completedAt?: string;
  completedBy?: "SHIPPER" | "SYSTEM";
  payoutStatus?: DealPayoutStatus;
  payoutSentAt?: string;
  /** Cause GROSSIÈRE d'un versement bloqué (A75) — jamais le message Stripe. */
  payoutBlocker?: DealPayoutBlocker;
  disputeTicket?: string;
  disputedAt?: string;
  /** Catégorie du signalement (A68) — jamais le dossier. */
  disputeCategory?: DealDisputeCategory;
};

export type DealPayoutStatus = "PENDING" | "SENT" | "FAILED" | "FROZEN";
export type DealPayoutBlocker = "ACCOUNT_NOT_READY" | "RETRYING";
export type DealDisputeCategory =
  | "NOT_DELIVERED"
  | "CONTENT_MISSING"
  | "DAMAGED"
  | "SIGNIFICANT_DELAY"
  | "RECIPIENT_ISSUE"
  | "OTHER";

/** Photo de remise en cours de saisie (A76) — même cycle que le litige : upload à la sélection. */
export type DeliveryPhotoDraft = {
  id: string;
  previewUrl?: string;
  file?: File;
  url?: string;
  uploading?: boolean;
  error?: string;
};
export const DELIVERY_PHOTOS_MAX = 2;

// ────────────────────────────────────────────────────────────
// Décline UX
// ────────────────────────────────────────────────────────────

// Aligné sur le contrat (DeclineReasonSchema, spec É2) — l'ancienne
// union locale (CATEGORY_NOT_TRANSPORTED…) était un vocabulaire mock.
export type DeclineReason =
  | "CATEGORY_NOT_CARRIED"
  | "TOO_HEAVY"
  | "PLACES_INCOMPATIBLE"
  | "TIMING"
  | "OTHER";

// Le contrat ne porte que la raison (le textarea « détails » du mock
// n'existait pas côté serveur — retiré de l'UI plutôt qu'ignoré).
export type DeclinePayload = {
  reason?: DeclineReason;
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

/** Ce que le formulaire tient (photos = fichiers locaux, pas encore téléversés). */
export type ConfirmPickupPayload = {
  checklist: PickupChecklistItemId[];
  photos: PickupPhotoDraft[];
  notes?: string;
};

/** Ce que l'API reçoit (D42/A43) : les URLs ImageKit, téléversées AVANT l'appel. */
export type ConfirmPickupApiPayload = {
  checklist: PickupChecklistItemId[];
  photoUrls: string[];
  notes?: string;
};

export type PickupRefuseReason =
  | "CONTENT_MISMATCH"
  | "SUSPICIOUS_CONTENT"
  | "OVERWEIGHT"
  | "BAD_PACKAGING"
  | "OTHER";

// Le contrat (RefusePickupRequest) ne porte que la raison — le textarea
// « détails » du mock a disparu (A43, miroir A32).
export type RefusePickupPayload = {
  reason?: PickupRefuseReason;
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
