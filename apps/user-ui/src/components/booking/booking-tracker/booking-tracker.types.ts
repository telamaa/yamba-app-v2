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
  | "AWAITING_CARRIER" // PENDING serveur — en attente de réponse du Voyageur
  | "ACCEPTED" // Un Voyageur a accepté (Phase 3 actuelle)
  | "PICKED_UP" // Voyageur a confirmé pickup, code livraison révélé
  | "IN_TRANSIT" // Colis en transport (dérivé : PICKED_UP + trackingEvents)
  | "DELIVERED" // Code validé par le Voyageur à l'arrivée
  | "VERIFIED" // COMPLETED serveur — vérification écoulée, payout libéré
  | "DISPUTED" // Sender a signalé un problème
  | "DECLINED" // Le Voyageur a refusé (remboursement intégral)
  | "EXPIRED" // 24 h sans réponse (remboursement intégral)
  | "CANCELLED";

export type BookingCarrier = {
  id: string;
  firstName: string;
  lastInitial: string;
  // Stats de réputation : naissent en B5 — absentes du contrat, jamais
  // inventées (A37). Les vues dégradent proprement.
  rating?: number;
  dealCount?: number;
  isVerified?: boolean;
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
  context:
    | "DECLARED_CONTENT"
    | "DECLARED_PACKAGED"
    | "PICKUP_CONTENT"
    | "PICKUP_PACKAGED"
    | "PICKUP_OTHER";
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
  // Métadonnées carte : viendront de Stripe (backlog A37) — le
  // paiement affiche le total seul d'ici là.
  cardBrand?: string; // "Visa", "Mastercard", ...
  cardLast4?: string; // "4242"
  statementDescriptor?: string; // "YAMBA*COLIS"
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
  /** Deadline d'acceptation 24 h (statut AWAITING_CARRIER). */
  expiresAt?: string;
  /** Posé sur DECLINED / EXPIRED / CANCELLED. */
  closedAt?: string;
  /** Fin de la fenêtre de vérification (J+4) — statut DELIVERED. */
  payoutDueAt?: string;
  /** Ticket YAM-XXXX si un litige est ouvert. */
  disputeTicket?: string;
  /** Ouverture du litige (ISO) — statut DISPUTED. */
  disputedAt?: string;
  /** Le dossier déposé (B4/A68) — servi à l'Expéditeur seul, en DISPUTED. */
  dispute?: BookingDisputeFile;
  /** Versement au Voyageur (B4/A68) : l'Expéditeur n'affiche JAMAIS un échec (2A). */
  payoutStatus?: "PENDING" | "SENT" | "FAILED" | "FROZEN";
  /** Qui a clos la transaction (COMPLETED) : confirmation anticipée ou J+4. */
  completedBy?: "SHIPPER" | "SYSTEM";
  completedAt?: string;
  /** PICKED_UP : quand « signaler un colis non livré » devient possible (servi, A72). */
  disputeOpensAt?: string;
  /** Machine d'état serveur — les CTA reflètent, ne décident jamais. */
  allowedActions?: string[];

  carrier: BookingCarrier;
  trip: BookingTrip;
  parcel: BookingParcel;
  pickupLocation: BookingLocation;
  recipient: BookingRecipient;
  insurance: BookingInsurance;

  payment: BookingPayment;
  deliveryCode: BookingDeliveryCode;

  pickup?: BookingPickupInfo; // présent dès PICKED_UP

  delivery?: BookingDeliveryInfo; // présent dès DELIVERED

  trackingEvents?: BookingTrackingEvent[]; // miroir des confirmations Voyageur
};


// ============================================================
// Post-pickup — feat/pickup-confirmation
// ============================================================

/** Nombre max de régénérations du code par l'Expéditeur */
export const MAX_CODE_REGENERATIONS = 5;

export type BookingPickupInfo = {
  pickedUpAt: string; // ISO — moment de la confirmation par le Voyageur
  locationName: string;
  photos: BookingPhoto[]; // photos prises par le Voyageur (context PICKUP_*)
  notes?: string;
};

// ============================================================
// Période de vérification (DELIVERED) — feat/verification-period
// ============================================================

export type BookingDeliveryInfo = {
  deliveredAt: string; // ISO — moment de la validation du code par le Voyageur
  validatedBy: "CODE";
};

/** Durée de la période de vérification avant versement automatique */
export const VERIFICATION_PERIOD_DAYS = 3;
export const PAYOUT_DAY = 4; // J+4


// ============================================================
// Signalement de litige — feat/dispute-form
// ============================================================

export type DisputeCategory =
  | "NOT_DELIVERED"        // Le colis n'a jamais été livré
  | "CONTENT_MISSING"      // Contenu manquant ou différent de la déclaration
  | "DAMAGED"              // Colis ou contenu endommagé
  | "SIGNIFICANT_DELAY"    // Délai dépassé significativement
  | "RECIPIENT_ISSUE"      // Le destinataire a un autre problème avec le voyageur
  | "OTHER";

export type DisputeDesiredOutcome =
  | "FULL_REFUND"          // Remboursement intégral
  | "PARTIAL_REFUND"       // Remboursement partiel (manque/dommage)
  | "CONTACT_CARRIER"      // Que Yamba contacte le Voyageur pour comprendre
  | "YAMBA_DECIDES";       // Je laisse Yamba décider

export type DisputePhotoDraft = {
  id: string;
  label?: string;
  previewUrl?: string;
  file?: File;
  /** URL ImageKit une fois l'upload direct terminé (D42, dossier deals/dispute/ — A73). */
  url?: string;
  uploading?: boolean;
  /** Message d'erreur d'upload (format, taille, réseau) — la photo n'est pas envoyable. */
  error?: string;
};

export type SubmitDisputePayload = {
  category: DisputeCategory;
  description: string; // min 50 caractères
  /** Photos DÉJÀ en ligne — seules les URL voyagent. */
  photoUrls: string[];
  desiredOutcome?: DisputeDesiredOutcome;
  pledgeAccepted: true;
};

/** Le dossier tel que déposé (lecture, vue DISPUTED — A74). */
export type BookingDisputeFile = {
  ticketNumber: string;
  category: DisputeCategory;
  description: string;
  desiredOutcome?: DisputeDesiredOutcome;
  photoUrls: string[];
  createdAt: string;
};

export const DISPUTE_MIN_DESCRIPTION_LENGTH = 50;
export const DISPUTE_MAX_PHOTOS = 5;


// ============================================================
// Suivi du voyage côté Expéditeur — feat/sender-tracking
// ============================================================

/** Miroir des événements confirmés par le Voyageur (philosophie A+B) */
export type BookingTrackingEventId =
  | "AT_AIRPORT"
  | "FLIGHT_DEPARTED"
  | "FLIGHT_ARRIVED";

export type BookingTrackingEvent = {
  id: BookingTrackingEventId;
  at: string; // ISO — quand le Voyageur a confirmé
};
