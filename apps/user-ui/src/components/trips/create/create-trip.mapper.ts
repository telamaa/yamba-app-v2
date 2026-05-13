/**
 * create-trip.mapper.ts
 * =====================
 * Convertit le Draft frontend en payload backend.
 *
 * Transformations :
 *  - camelCase → SCREAMING_SNAKE_CASE (plane → PLANE)
 - from/to labels + PlaceInfo → origin*/
// destination* (avec codes ISO)
  // - priceAmount (€) → priceAmountCents
  // - Date + time string → ISO departureAt
  // - categoryConditions Record → Array


import type { Draft, CategoryCondition } from "./create-trip.types";

// ─── Enum conversion ─────────────────────────

function toSnakeEnum(val: string | null | undefined): string | null {
  if (!val) return null;
  return val.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

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

function toDateLocal(date?: Date): string | null {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

  // Origin
  originLabel: string | null;
  originPlaceId: string | null;
  originCity: string | null;
  originCityCode: string | null;       // ✨ NEW
  originRegion: string | null;
  originRegionCode: string | null;     // ✨ NEW
  originCountry: string | null;
  originCountryCode: string | null;    // ✨ NEW
  originLat: number | null;
  originLng: number | null;

  // Destination
  destinationLabel: string | null;
  destinationPlaceId: string | null;
  destinationCity: string | null;
  destinationCityCode: string | null;       // ✨ NEW
  destinationRegion: string | null;
  destinationRegionCode: string | null;     // ✨ NEW
  destinationCountry: string | null;
  destinationCountryCode: string | null;    // ✨ NEW
  destinationLat: number | null;
  destinationLng: number | null;

  // Dates
  departureDateLocal: string | null;
  arrivalDateLocal: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  returnDepartureAt: string | null;
  returnArrivalAt: string | null;

  // Mode-specific
  flightType: string | null;
  trainTripType: string | null;
  carTripFlexibility: string | null;
  flightLayoverCities: string[];
  trainStopCities: string[];
  travelReference: string | null;

  // Conditions
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

  const resolvePrice = (condition: CategoryCondition): number => {
    if (draft.useGlobalPrice && typeof draft.globalPrice === "number") {
      return draft.globalPrice;
    }
    return typeof condition.priceAmount === "number" ? condition.priceAmount : 0;
  };

  const splitCities = (raw: string): string[] =>
    raw.split(",").map((s) => s.trim()).filter(Boolean);

  return {
    // ── Trajet ──
    transportMode: toSnakeEnum(draft.transportMode),
    tripType: toSnakeEnum(draft.tripType) ?? "ONE_WAY",

    // ── Origine ──
    originLabel: draft.from || null,
    originPlaceId: fromPlace?.placeId ?? null,
    originCity: fromPlace?.city ?? null,
    originCityCode: fromPlace?.cityCode ?? null,         // ✨ NEW
    originRegion: fromPlace?.region ?? null,
    originRegionCode: fromPlace?.regionCode ?? null,     // ✨ NEW
    originCountry: fromPlace?.country ?? null,
    originCountryCode: fromPlace?.countryCode ?? null,   // ✨ NEW
    originLat: fromPlace?.lat ?? null,
    originLng: fromPlace?.lng ?? null,

    // ── Destination ──
    destinationLabel: draft.to || null,
    destinationPlaceId: toPlace?.placeId ?? null,
    destinationCity: toPlace?.city ?? null,
    destinationCityCode: toPlace?.cityCode ?? null,           // ✨ NEW
    destinationRegion: toPlace?.region ?? null,
    destinationRegionCode: toPlace?.regionCode ?? null,       // ✨ NEW
    destinationCountry: toPlace?.country ?? null,
    destinationCountryCode: toPlace?.countryCode ?? null,     // ✨ NEW
    destinationLat: toPlace?.lat ?? null,
    destinationLng: toPlace?.lng ?? null,

    // ── Dates ──
    departureDateLocal: toDateLocal(draft.departureDate),
    arrivalDateLocal: toDateLocal(draft.arrivalDate),
    departureTimeLocal: draft.departureTime || null,
    arrivalTimeLocal: draft.arrivalTime || null,
    departureAt: toDateTimeIso(draft.departureDate, draft.departureTime),
    arrivalAt: toDateTimeIso(draft.arrivalDate, draft.arrivalTime),
    returnDepartureAt: null,
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

    // ── Publish ──
    publish,
  };
}
