export type ParcelCategory =
  | "clothes"
  | "shoes"
  | "fashion-accessories"
  | "other-accessories"
  | "books"
  | "documents"
  | "small-toys"
  | "phone"
  | "computer"
  | "other-electronics"
  | "checked-bag-23kg"
  | "cabin-bag-12kg";

export type TransportMode = "plane" | "train" | "car";
export type SortOption = "earliest" | "lowestPrice" | "bestRated";

export type DepartureTimeBucket =
  | "earlyMorning" // 04:00 - 09:00
  | "morning" // 09:00 - 12:00
  | "afternoon" // 12:00 - 18:00
  | "evening"; // 18:00 - 04:00

/**
 * Map d'un prix par catégorie autorisée.
 * Chaque catégorie a un prix spécifique. Le prix affiché sur la card
 * est le minimum de cette map (= minPrice).
 */
export type PricesByCategory = Partial<Record<ParcelCategory, number>>;

export type YambaTripResult = {
  id: string;
  fromCity: string;
  fromCityCode?: string;
  fromCountry?: string;
  toCity: string;
  toCityCode?: string;
  toCountry?: string;
  travelDate: string;
  departureTime?: string;
  arrivalTime?: string;
  /** True si l'arrivée est le jour suivant (pour afficher +1) */
  nextDay?: boolean;
  /** Durée en minutes (pour afficher 6H 30) */
  durationMinutes?: number;
  /** Nombre d'escales (0 = direct) */
  stopovers?: number;
  /** Ville d'escale (si stopovers > 0) */
  stopoverCity?: string;
  minPrice: number;
  /**
   * Prix par catégorie. Le minimum de cette map = minPrice.
   * Affiché dans le bottom sheet "tarifs par catégorie" sur mobile.
   */
  pricesByCategory?: PricesByCategory;
  currency?: string;
  transportMode: TransportMode;
  allowedCategories: ParcelCategory[];

  /** Nombre de places restantes (pour afficher l'alerte si <3) */
  remainingSlots?: number;

  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;

  /** Note moyenne du tripper (sur 5) */
  rating?: number;
  /** Nombre d'avis */
  reviewCount?: number;

  travelerFirstName?: string;
  travelerLastName?: string;
  travelerAvatarUrl?: string;
};
