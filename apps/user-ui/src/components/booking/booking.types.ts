/**
 * booking.types.ts
 * ================
 * Source of truth for the shipper booking wizard.
 */

// ============================================================
// PARCEL
// ============================================================

export type ParcelCategory =
  | "CLOTHES"
  | "SHOES"
  | "FASHION_ACCESSORIES"
  | "OTHER_ACCESSORIES"
  | "BOOKS"
  | "DOCUMENTS"
  | "SMALL_TOYS"
  | "PHONE"
  | "COMPUTER"
  | "OTHER_ELECTRONICS"
  | "CHECKED_BAG_23KG"
  | "CABIN_BAG_12KG";

export const PARCEL_CATEGORIES: readonly ParcelCategory[] = [
  "CLOTHES",
  "SHOES",
  "FASHION_ACCESSORIES",
  "OTHER_ACCESSORIES",
  "BOOKS",
  "DOCUMENTS",
  "SMALL_TOYS",
  "PHONE",
  "COMPUTER",
  "OTHER_ELECTRONICS",
  "CHECKED_BAG_23KG",
  "CABIN_BAG_12KG",
] as const;

export type InsuranceTier = "BASIC" | "EXTENDED_500";

/** D14 — familles de risque (mêmes clés que l'API) */
export type ParcelFamily =
  | "DOCUMENTS_PAPERS" | "CLOTHES_TEXTILE" | "FOOD_DRY_SEALED" | "ELECTRONICS_DEVICES"
  | "COSMETICS_CARE" | "PARTS_TOOLS" | "TOYS_CHILDCARE" | "MISC_ACCESSORIES";
export const PARCEL_FAMILIES: readonly ParcelFamily[] = [
  "DOCUMENTS_PAPERS", "CLOTHES_TEXTILE", "FOOD_DRY_SEALED", "ELECTRONICS_DEVICES",
  "COSMETICS_CARE", "PARTS_TOOLS", "TOYS_CHILDCARE", "MISC_ACCESSORIES",
] as const;
export type FamilyStance = { mode: "ACCEPT" | "SURCHARGE" | "REFUSE"; surchargePct: number };
/** PRC-03 — classes de taille visuelles */
export type SizeClass = "S" | "M" | "L";
/** PRC-04 — ce qu'on envoie : un colis au kilo, ou un bagage entier forfaitaire */
export type ParcelProduct = "PARCEL" | "CHECKED_BAG_23KG" | "CABIN_BAG_12KG";
export type PaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY";
export type PhotoContext = "DECLARED_CONTENT" | "DECLARED_PACKAGED" | "CUSTOM";

export type ParcelPhoto = {
  id: string;
  file: File | null;
  previewUrl: string | null;
  context: PhotoContext;
  label?: string;
};

// ============================================================
// LOCATIONS
// ============================================================

export type LocationKind =
  | "AIRPORT"
  | "TRAIN_STATION"
  | "BUS_STATION"
  | "PARCEL_POINT"
  | "ADDRESS"
  | "OTHER";

export type LocationPoint = {
  id: string;
  kind: LocationKind;
  label: string;
  subLabel?: string;
  addressShort?: string;
  city?: string;
  countryCode?: string;
};

// ============================================================
// TRIP CONTEXT
// ============================================================

export type TripCarrier = {
  id: string;
  firstName: string;
  lastInitial: string;
  avatarUrl?: string;
  rating: number;
  dealCount: number;
};

export type TripContext = {
  tripId: string;
  carrier: TripCarrier;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  departureDate: string; // ISO
  travelMode: "PLANE" | "TRAIN" | "CAR" | "BUS";
  isDirect: boolean;
  durationHours?: number;
  pickupOptions: LocationPoint[];
  deliveryOptions: LocationPoint[];

  /** @deprecated legacy PER_CATEGORY — vide pour un trajet au kilo */
  acceptedCategories: ParcelCategory[];
  /** @deprecated legacy PER_CATEGORY */
  categoryPrices: Partial<Record<ParcelCategory, number>>;
  /** @deprecated remplacé par PRICING_PARAMS (@packages/pricing) */
  serviceFeePercent: number;

  // ⭐ Moteur PER_KG (D13/D14/D19) — cents, comme l'API
  pricePerKgCents: number | null;
  remainingKg: number | null;
  familyStances: Record<ParcelFamily, FamilyStance>;
  checkedBag23PriceCents: number | null;
  cabinBag12PriceCents: number | null;
};

// ============================================================
// RECIPIENT
// ============================================================

export type RecipientInfo = {
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string;
};

// ============================================================
// DRAFT
// ============================================================

export type Step = 1 | 2 | 3 | 4;

export type Draft = {
  pickupLocationId: string | null;
  deliveryLocationId: string | null;
  /** @deprecated legacy — conservé pour les anciens trajets */
  category: ParcelCategory;
  /** PRC-04 : colis au kilo ou bagage entier */
  product: ParcelProduct;
  /** D14 */
  family: ParcelFamily;
  /** PRC-03 */
  sizeClass: SizeClass;
  weightKg: string;
  declaredValueEur: string;
  description: string;
  photos: ParcelPhoto[];
  insurance: InsuranceTier;

  recipient: RecipientInfo;

  charterAccepted: boolean;
  termsAccepted: boolean;

  paymentMethod: PaymentMethod;
};

// ============================================================
// PRICING
// ============================================================

export type PriceBreakdown = {
  transport: number;
  serviceFee: number;
  insurance: number;
  total: number;
  currency: "EUR";
  /** D34 — le devis complet (cents) tel qu'il sera figé (D17) ; null si le devis est impossible */
  quote: import("@packages/pricing").ShipperQuote | null;
  /** motif d'indisponibilité du devis (trajet legacy, poids manquant…) */
  quoteError: string | null;
};

// ============================================================
// VALIDATION
// ============================================================

export type ValidationErrors = Partial<{
  pickupLocationId: string;
  deliveryLocationId: string;
  category: string;
  family: string;
  product: string;
  sizeClass: string;
  weightKg: string;
  declaredValueEur: string;
  description: string;
  photos: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhoneE164: string;
  recipientEmail: string;
  charterAccepted: string;
  termsAccepted: string;
  paymentMethod: string;
}>;

// ============================================================
// API STUB
// ============================================================

export type CreateDealResponse = {
  dealId: string;
  paymentClientSecret?: string;
};
