import type {
  TransportMode,
  FlightType,
  TrainTripType,
  CarTripFlexibility,
} from "./public-trip.types";

/**
 * Types matching the DTO returned by GET /users/:slug/public
 *
 * Source de vérité : apps/auth-service/src/controller/user-public.controller.ts
 * Si le DTO backend change, mettre à jour ce fichier.
 */

export type ReviewKind = "AS_CARRIER" | "AS_SHIPPER";

// ─── Sous-objets ─────────────────────────────────────────

export type PublicTripPreview = {
  id: string;
  transportMode: TransportMode | null;
  originCity: string | null;
  destinationCity: string | null;
  departureAt: string | null; // ISO date string (l'API renvoie en JSON)
  flightType: FlightType | null;
  trainTripType: TrainTripType | null;
  carTripFlexibility: CarTripFlexibility | null;
  minPriceCents: number | null;
  currencyCode: string;
};

export type ReputationLevel = "NEW" | "CONFIRMED" | "TOP";
export type PublicReputation = {
  level: ReputationLevel;
  ratingsAvg: number;
  ratingsCount: number;
  completedDealsCount: number;
  lateCancellationsCount: number;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  /** B5 — pouces des critères, publics comme la note. */
  criteria?: Record<string, "UP" | "DOWN"> | null;
  createdAt: string;
  author: {
    firstName: string;
    lastInitial: string;
    avatarUrl: string | null;
  };
};

export type PublicTopRoute = {
  originCity: string;
  destinationCity: string;
  count: number;
};

// ─── Blocs ───────────────────────────────────────────────

export type PublicLocation = {
  city: string | null;
  country: string | null;
  countryCode: string | null; // ISO 2 letters, pour Intl.DisplayNames futur
};

export type PublicStats = {
  tripsPublishedCount: number;
  parcelsCarriedCount: number;
  parcelsSentCount: number;
};

export type PublicRating = {
  average: number;
  count: number;
};

export type PublicTripperBlock = {
  bio: string | null;
  badges: {
    isVerified: boolean;
    isSuperCarrier: boolean;
  };
  topRoutes: PublicTopRoute[];
  availableTripsPreview: PublicTripPreview[];
  availableTripsCount: number;
  reviewsPreview: PublicReview[];
  reviewsCount: number;
};

export type PublicShipperBlock = {
  reviewsPreview: PublicReview[];
  reviewsCount: number;
};

export type PublicUserFollow = {
  followersCount: number;
  followingCount: number;
  // null = utilisateur non connecté ; bool = connecté
  isFollowedByMe: boolean | null;
  notifyNextTrip: boolean | null;
};

// ─── DTO racine ──────────────────────────────────────────

export type PublicUser = {
  publicSlug: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  memberSince: string; // ISO date

  location: PublicLocation;
  stats: PublicStats;

  // Notes séparées par rôle (architecture long terme)
  tripperRating: PublicRating | null; // null si pas tripper actif
  shipperRating: PublicRating;

  /** B5 / D29① — réputation explicable : niveau + faits, calculés serveur. */
  reputation?: {
    carrier: PublicReputation | null;
    shipper: PublicReputation;
  };

  tripper: PublicTripperBlock | null; // null si pas tripper actif
  shipper: PublicShipperBlock;

  follow: PublicUserFollow;
  isOwnProfile: boolean;
};

// ─── Réponses API paginées ───────────────────────────────

export type PaginatedReviewsResponse = {
  success: boolean;
  reviews: PublicReview[];
  nextCursor: string | null;
};

export type PaginatedTripsResponse = {
  success: boolean;
  trips: PublicTripPreview[];
  nextCursor: string | null;
};
