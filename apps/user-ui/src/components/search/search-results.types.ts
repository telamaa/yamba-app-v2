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

/** D14 — familles de risque (mêmes clés que l'API / Prisma ParcelFamily) */
export const SEARCH_FAMILIES = [
  "DOCUMENTS_PAPERS",
  "CLOTHES_TEXTILE",
  "FOOD_DRY_SEALED",
  "ELECTRONICS_DEVICES",
  "COSMETICS_CARE",
  "PARTS_TOOLS",
  "TOYS_CHILDCARE",
  "MISC_ACCESSORIES",
] as const;
export type SearchFamily = (typeof SEARCH_FAMILIES)[number];

export type SearchFamilyCondition = {
  familyKey: SearchFamily | string;
  mode: "SURCHARGE" | "REFUSE";
  surchargePct?: number | null;
};
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
  /** D13 — moteur PER_KG : prix au kilo en euros. null/absent = legacy PER_CATEGORY */
  pricePerKg?: number | null;
  /** CAP-02 — kilos encore disponibles (capacité − réservé) */
  remainingKg?: number | null;
  /** D14 — positions ≠ ACCEPT du Voyageur (compact) */
  familyConditions?: SearchFamilyCondition[];
  /** D33 V2 — présents si un poids a été saisi (euros) */
  weightKg?: number;
  transportForWeight?: number | null;
  totalForWeight?: number | null;
  currency?: string;
  transportMode: TransportMode;
  allowedCategories: ParcelCategory[];

  /** Nombre de places restantes (pour afficher l'alerte si <3) */
  remainingSlots?: number;

  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;
  /** D5 / C-PR6 — vues dédoublonnées de la page du trajet (absent si indisponible) */
  viewsCount?: number;

  /** Note moyenne du tripper (sur 5) */
  rating?: number;
  /** Nombre d'avis */
  reviewCount?: number;
  /** D46 — favori de l'utilisateur connecté (false / absent pour un visiteur) */
  isFavorite?: boolean;

  travelerFirstName?: string;
  travelerLastName?: string;
  travelerAvatarUrl?: string;
};
