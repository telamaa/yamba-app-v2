// /**
//  * create-trip.mapper.ts
//  * =====================
//  * Converts the frontend Draft object into the backend API payload.
//  *
//  * Key transformations:
//  *  - camelCase enums → SCREAMING_SNAKE_CASE (plane → PLANE, oneWay → ONE_WAY)
//  // *  - from/to labels + PlaceInfo → origin*/destination* flat fields
// // *  - priceAmount (€) → priceAmountCents (centimes)
// // *  - Date + time string → ISO departureAt / departureDateLocal
// // *  - categoryConditions Record → Array
// // *
// // * 📁 Place in: apps/user-ui/src/components/trips/create/create-trip.mapper.ts
// // */

import type { Draft, CategoryCondition } from "./create-trip.types";

// ─── Enum conversion ─────────────────────────

/**
 * Generic camelCase → SCREAMING_SNAKE_CASE.
 * Works for: plane→PLANE, oneWay→ONE_WAY, withLayover→WITH_LAYOVER, etc.
 */
function toSnakeEnum(val: string | null | undefined): string | null {
  if (!val) return null;
  return val.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * ParcelCategory explicit map — handles number-containing keys
 * (checkedBag23kg → CHECKED_BAG_23KG) that the generic regex can't solve.
 */
const CATEGORY_ENUM: Record<string, string> = {
  clothes: "CLOTHES",
  shoes: "SHOES",
  fashionAccessories: "FASHION_ACCESSORIES",
  otherAccessories: "OTHER_ACCESSORIES",
  books: "BOOKS",
  documents: "DOCUMENTS",
  smallToys: "SMALL_TOYS",
  phone: "PHONE",
  computer: "COMPUTER",
  otherElectronics: "OTHER_ELECTRONICS",
  checkedBag23kg: "CHECKED_BAG_23KG",
  cabinBag12kg: "CABIN_BAG_12KG",
};

function mapCategory(key: string): string {
  return CATEGORY_ENUM[key] ?? toSnakeEnum(key) ?? key;
}

// ─── Date helpers ────────────────────────────

/** Date → "YYYY-MM-DD" */
function toDateLocal(date?: Date): string | null {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Combine Date + "HH:MM" → ISO string */
function toDateTimeIso(date?: Date, time?: string): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
  }
  return d.toISOString();
}

// ─── Payload type ────────────────────────────

export type CreateTripPayload = {
  transportMode: string | null;
  tripType: string;
  originLabel: string | null;
  originPlaceId: string | null;
  originCity: string | null;
  originRegion: string | null;
  originCountry: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLabel: string | null;
  destinationPlaceId: string | null;
  destinationCity: string | null;
  destinationRegion: string | null;
  destinationCountry: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  departureDateLocal: string | null;
  arrivalDateLocal: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  returnDepartureAt: string | null;
  returnArrivalAt: string | null;
  flightType: string | null;
  trainTripType: string | null;
  carTripFlexibility: string | null;
  flightLayoverCities: string[];
  trainStopCities: string[];
  travelReference: string | null;
  acceptedCategories: string[];
  categoryConditions: Array<{
    category: string;
    priceAmountCents: number;
    handoffMoments: string[];
    pickupMoments: string[];
  }>;
  handDeliveryOnly: boolean;
  instantBooking: boolean;
  currencyCode: string;
  notes: string | null;
  publish: boolean;
};

// ─── Mapper ──────────────────────────────────

export function mapDraftToPayload(draft: Draft, publish: boolean): CreateTripPayload {
  const { fromPlace, toPlace } = draft;

  // Price: si useGlobalPrice, on applique le globalPrice à toutes les catégories
  const resolvePrice = (condition: CategoryCondition): number => {
    if (draft.useGlobalPrice && typeof draft.globalPrice === "number") {
      return draft.globalPrice;
    }
    return typeof condition.priceAmount === "number" ? condition.priceAmount : 0;
  };

  // Layover/stop cities: "Paris, Lyon" → ["Paris", "Lyon"]
  const splitCities = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    // ── Trajet ──
    transportMode: toSnakeEnum(draft.transportMode),
    tripType: toSnakeEnum(draft.tripType) ?? "ONE_WAY",

    // ── Origine ──
    originLabel: draft.from || null,
    originPlaceId: fromPlace?.placeId ?? null,
    originCity: fromPlace?.city ?? null,
    originRegion: fromPlace?.region ?? null,
    originCountry: fromPlace?.country ?? null,
    originLat: fromPlace?.lat ?? null,
    originLng: fromPlace?.lng ?? null,

    // ── Destination ──
    destinationLabel: draft.to || null,
    destinationPlaceId: toPlace?.placeId ?? null,
    destinationCity: toPlace?.city ?? null,
    destinationRegion: toPlace?.region ?? null,
    destinationCountry: toPlace?.country ?? null,
    destinationLat: toPlace?.lat ?? null,
    destinationLng: toPlace?.lng ?? null,

    // ── Dates ──
    departureDateLocal: toDateLocal(draft.departureDate),
    arrivalDateLocal: toDateLocal(draft.arrivalDate),
    departureTimeLocal: draft.departureTime || null,
    arrivalTimeLocal: draft.arrivalTime || null,
    departureAt: toDateTimeIso(draft.departureDate, draft.departureTime),
    arrivalAt: toDateTimeIso(draft.arrivalDate, draft.arrivalTime),
    returnDepartureAt: null, // TODO: aller-retour
    returnArrivalAt: null,

    // ── Mode-specific ──
    flightType: toSnakeEnum(draft.flightType),
    trainTripType: toSnakeEnum(draft.trainTripType),
    carTripFlexibility: toSnakeEnum(draft.carTripFlexibility),
    flightLayoverCities: splitCities(draft.flightLayoverCities),
    trainStopCities: splitCities(draft.trainStopCities),
    travelReference: draft.travelReference?.trim() || null,

    // ── Conditions ──
    acceptedCategories: draft.acceptedCategories.map(mapCategory),
    categoryConditions: Object.values(draft.categoryConditions)
      .filter((c): c is CategoryCondition => !!c)
      .map((c) => ({
        category: mapCategory(c.categoryKey),
        priceAmountCents: Math.round(resolvePrice(c) * 100),
        handoffMoments: c.handoffMoments.map((m) => toSnakeEnum(m)!),
        pickupMoments: c.pickupMoments.map((m) => toSnakeEnum(m)!),
      })),

    // ── Options ──
    handDeliveryOnly: draft.handDeliveryOnly,
    instantBooking: draft.instantBooking,
    currencyCode: draft.currencyCode,
    notes: draft.notes?.trim() || null,

    // ── Publish flag ──
    publish,
  };
}
