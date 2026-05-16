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

  /** Categories the carrier accepts on this trip */
  acceptedCategories: ParcelCategory[];
  /** Price (EUR) per accepted category */
  categoryPrices: Partial<Record<ParcelCategory, number>>;

  serviceFeePercent: number;
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
  category: ParcelCategory;
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
};

// ============================================================
// VALIDATION
// ============================================================

export type ValidationErrors = Partial<{
  pickupLocationId: string;
  deliveryLocationId: string;
  category: string;
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
