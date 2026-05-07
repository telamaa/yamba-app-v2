import type {
  Trip,
  User,
  CarrierPage,
  Image,
  TripCategoryCondition,
} from "@prisma/client";
import {
  TransportMode as DbTransportMode,
  ParcelCategory as DbParcelCategory,
} from "@prisma/client";
import { symbolFor } from "./currency";
import {
  formatTripDate,
  formatTripTime,
  isNextDay,
  computeHourLocal,
  type SupportedLocale,
} from "./timezone-format";

// ─────────────────────────────────────────────────────
// UI TYPES (miroir de search-results.types.ts côté front)
// ─────────────────────────────────────────────────────

export type UiTransportMode = "plane" | "train" | "car";

export type UiParcelCategory =
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

export type YambaTripResultDto = {
  id: string;
  fromCity: string;
  fromCityCode?: string;
  fromCountry?: string;
  toCity: string;
  toCityCode?: string;
  toCountry?: string;
  travelDate: string;            // "12 juin 2026" / "June 12, 2026"
  departureTime: string;         // "08:00"
  arrivalTime: string;           // "14:30"
  nextDay?: boolean;
  durationMinutes?: number;
  stopovers?: number;
  stopoverCity?: string;
  minPrice: number;
  pricesByCategory: Record<string, number>;
  currency: string;              // "€", "$", etc.
  transportMode: UiTransportMode;
  allowedCategories: UiParcelCategory[];
  remainingSlots?: number;
  superTripper: boolean;
  profileVerified: boolean;
  instantBooking: boolean;
  verifiedTicket: boolean;
  rating?: number;
  reviewCount?: number;
  travelerFirstName?: string;
  travelerLastName?: string;     // toujours juste l'initiale (privacy)
  travelerAvatarUrl?: string;
};

// ─────────────────────────────────────────────────────
// ENUM MAPPERS
// ─────────────────────────────────────────────────────

const TRANSPORT_DB_TO_UI: Record<DbTransportMode, UiTransportMode> = {
  PLANE: "plane",
  TRAIN: "train",
  CAR: "car",
};

const TRANSPORT_UI_TO_DB: Record<UiTransportMode, DbTransportMode> = {
  plane: "PLANE",
  train: "TRAIN",
  car: "CAR",
};

const CATEGORY_DB_TO_UI: Record<DbParcelCategory, UiParcelCategory> = {
  CLOTHES: "clothes",
  SHOES: "shoes",
  FASHION_ACCESSORIES: "fashion-accessories",
  OTHER_ACCESSORIES: "other-accessories",
  BOOKS: "books",
  DOCUMENTS: "documents",
  SMALL_TOYS: "small-toys",
  PHONE: "phone",
  COMPUTER: "computer",
  OTHER_ELECTRONICS: "other-electronics",
  CHECKED_BAG_23KG: "checked-bag-23kg",
  CABIN_BAG_12KG: "cabin-bag-12kg",
};

const CATEGORY_UI_TO_DB: Record<UiParcelCategory, DbParcelCategory> = {
  clothes: "CLOTHES",
  shoes: "SHOES",
  "fashion-accessories": "FASHION_ACCESSORIES",
  "other-accessories": "OTHER_ACCESSORIES",
  books: "BOOKS",
  documents: "DOCUMENTS",
  "small-toys": "SMALL_TOYS",
  phone: "PHONE",
  computer: "COMPUTER",
  "other-electronics": "OTHER_ELECTRONICS",
  "checked-bag-23kg": "CHECKED_BAG_23KG",
  "cabin-bag-12kg": "CABIN_BAG_12KG",
};

export function transportModeDbToUi(mode: DbTransportMode): UiTransportMode {
  return TRANSPORT_DB_TO_UI[mode];
}

export function transportModeUiToDb(mode: UiTransportMode): DbTransportMode {
  return TRANSPORT_UI_TO_DB[mode];
}

export function parcelCategoryDbToUi(cat: DbParcelCategory): UiParcelCategory {
  return CATEGORY_DB_TO_UI[cat];
}

export function parcelCategoryUiToDb(cat: UiParcelCategory): DbParcelCategory {
  return CATEGORY_UI_TO_DB[cat];
}

// ─────────────────────────────────────────────────────
// COMPUTED FIELDS (utilisés par createTrip / updateTrip)
// ─────────────────────────────────────────────────────

/**
 * Calcule le prix minimum (en cents) parmi toutes les categoryConditions.
 * @returns null si aucune condition (le trip ne sera pas listable mais reste valide en DRAFT).
 */
export function computeMinPriceCents(
  conditions: TripCategoryCondition[] | null | undefined
): number | null {
  if (!conditions || conditions.length === 0) return null;
  const prices = conditions.map((c) => c.priceAmountCents);
  return Math.min(...prices);
}

/**
 * Re-export du helper TZ pour cohérence des imports côté controllers.
 */
export { computeHourLocal };

// ─────────────────────────────────────────────────────
// BUCKET HORAIRE (filtre "matin/aprem/soir/nuit")
// ─────────────────────────────────────────────────────

export type DepartureBucket = "earlyMorning" | "morning" | "afternoon" | "evening";

/**
 * Convertit un bucket en condition Prisma sur departureHourLocal.
 * Aligné sur le helper côté front (getDepartureTimeBucket.ts).
 *
 *  - earlyMorning : 04:00 - 08:59
 *  - morning      : 09:00 - 11:59
 *  - afternoon    : 12:00 - 17:59
 *  - evening      : 18:00 - 03:59 (englobe la nuit)
 */
export function bucketToHourCondition(bucket: DepartureBucket): {
  departureHourLocal?: { gte?: number; lt?: number };
  OR?: Array<{ departureHourLocal: { gte?: number; lt?: number } }>;
} {
  switch (bucket) {
    case "earlyMorning":
      return { departureHourLocal: { gte: 4, lt: 9 } };
    case "morning":
      return { departureHourLocal: { gte: 9, lt: 12 } };
    case "afternoon":
      return { departureHourLocal: { gte: 12, lt: 18 } };
    case "evening":
      // 18:00 → 23:59 OU 00:00 → 03:59
      return {
        OR: [
          { departureHourLocal: { gte: 18 } },
          { departureHourLocal: { lt: 4 } },
        ],
      };
  }
}

// ─────────────────────────────────────────────────────
// MAPPER PRINCIPAL : Trip Prisma → DTO UI
// ─────────────────────────────────────────────────────

/**
 * Type étendu du Trip avec les relations qu'on doit include dans le findMany.
 */
export type TripWithRelations = Trip & {
  user: (User & { avatar: Image | null }) | null;
  carrierPage: CarrierPage | null;
};

export const TRIP_SEARCH_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: { select: { url: true } },
    },
  },
  carrierPage: {
    select: {
      id: true,
      isVerified: true,
      isSuperCarrier: true,
      ratingsAvg: true,
      ratingsCount: true,
    },
  },
} as const;

/**
 * Transforme un Trip Prisma (avec relations) en DTO consommable par la UI.
 *
 * Règles importantes :
 * - travelerLastName = juste l'initiale (privacy par défaut)
 * - rating/reviewCount = undefined si ratingsCount === 0 (pas de "0,0")
 * - currency = symbole ("€"), pas le code ISO
 * - dates/heures formatées dans la TZ correcte (origin pour départ, dest pour arrivée)
 * - remainingSlots = undefined si maxSlots null (capacité illimitée → pas de badge UI)
 */
export function mapTripToYambaResult(
  trip: TripWithRelations,
  locale: SupportedLocale = "fr"
): YambaTripResultDto {
  if (!trip.departureAt || !trip.arrivalAt) {
    throw new Error(
      `Trip ${trip.id} has no departureAt/arrivalAt — should not be in search results`
    );
  }
  if (!trip.transportMode) {
    throw new Error(
      `Trip ${trip.id} has no transportMode — should not be in search results`
    );
  }
  if (!trip.originCity || !trip.destinationCity) {
    throw new Error(
      `Trip ${trip.id} missing origin/destination city — should not be in search results`
    );
  }

  // ─── Pricing ───────────────────────────────────────
  const pricesByCategory: Record<string, number> = {};
  for (const cond of trip.categoryConditions) {
    const uiCategory = parcelCategoryDbToUi(cond.category);
    pricesByCategory[uiCategory] = cond.priceAmountCents / 100;
  }
  const minPrice = trip.minPriceCents != null ? trip.minPriceCents / 100 : 0;

  // ─── Stopovers ─────────────────────────────────────
  let stopoverCities: string[] = [];
  if (trip.transportMode === "PLANE") stopoverCities = trip.flightLayoverCities;
  else if (trip.transportMode === "TRAIN") stopoverCities = trip.trainStopCities;

  const stopovers = stopoverCities.length;
  const stopoverCity = stopovers === 1 ? stopoverCities[0] : undefined;

  // ─── Heures locales (avec fallback sur les champs *Local stockés) ──
  // Si departureTimeLocal est rempli au create (ex: "08:00"), on l'utilise.
  // Sinon on calcule depuis departureAt + originTimezone.
  const departureTime =
    trip.departureTimeLocal ||
    formatTripTime(trip.departureAt, trip.originTimezone);

  const arrivalTime =
    trip.arrivalTimeLocal ||
    formatTripTime(trip.arrivalAt, trip.destinationTimezone);

  // ─── Date affichage ────────────────────────────────
  const travelDate = formatTripDate(trip.departureAt, trip.originTimezone, locale);

  // ─── Next day ──────────────────────────────────────
  const nextDay = isNextDay(
    trip.departureAt,
    trip.arrivalAt,
    trip.originTimezone,
    trip.destinationTimezone
  );

  // ─── Durée ─────────────────────────────────────────
  const durationMinutes = Math.round(
    (trip.arrivalAt.getTime() - trip.departureAt.getTime()) / 60000
  );

  // ─── Capacité résiduelle ───────────────────────────
  const remainingSlots =
    trip.maxSlots != null
      ? Math.max(0, trip.maxSlots - trip.bookedSlots)
      : undefined;

  // ─── Carrier info ──────────────────────────────────
  const cp = trip.carrierPage;
  const superTripper = cp?.isSuperCarrier ?? false;
  const profileVerified = cp?.isVerified ?? false;
  const rating = cp && cp.ratingsCount > 0 ? cp.ratingsAvg : undefined;
  const reviewCount =
    cp && cp.ratingsCount > 0 ? cp.ratingsCount : undefined;

  // ─── Verified ticket ───────────────────────────────
  const verifiedTicket = trip.ticketVerificationStatus === "VERIFIED";

  // ─── User info (privacy : juste l'initiale du nom) ──
  const u = trip.user;
  const travelerFirstName = u?.firstName;
  const travelerLastName = u?.lastName
    ? u.lastName.charAt(0).toUpperCase()
    : undefined;
  const travelerAvatarUrl = u?.avatar?.url || undefined;

  return {
    id: trip.id,
    fromCity: trip.originCity,
    fromCityCode: trip.originCityCode || undefined,
    fromCountry: trip.originCountry || undefined,
    toCity: trip.destinationCity,
    toCityCode: trip.destinationCityCode || undefined,
    toCountry: trip.destinationCountry || undefined,
    travelDate,
    departureTime,
    arrivalTime,
    nextDay: nextDay || undefined,
    durationMinutes,
    stopovers,
    stopoverCity,
    minPrice,
    pricesByCategory,
    currency: symbolFor(trip.currencyCode),
    transportMode: transportModeDbToUi(trip.transportMode),
    allowedCategories: trip.acceptedCategories.map(parcelCategoryDbToUi),
    remainingSlots,
    superTripper,
    profileVerified,
    instantBooking: trip.instantBooking,
    verifiedTicket,
    rating,
    reviewCount,
    travelerFirstName,
    travelerLastName,
    travelerAvatarUrl,
  };
}
