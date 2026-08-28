/**
 * create-trip.mapper.ts
 * =====================
 * Convertit le Draft frontend en payload backend.
 *
 * Transformations :
 *  - camelCase → SCREAMING_SNAKE_CASE (plane → PLANE)
 *  - from/to labels + PlaceInfo → origin* / destination* (avec codes ISO)
 *  - priceAmount (€) → priceAmountCents
 *  - Date + time string → ISO departureAt
 *  - categoryConditions Record → Array (legacy PER_CATEGORY)
 *  - pricePerKg / bagages (€) → *Cents ; familyConditions Record → Array
 *    (seules les familles ≠ ACCEPT voyagent : null/vide = tout accepté)
 *  - pickupLocations / deliveryLocations : filtre enabled, strip id, normalise
 */

import type {
  Draft,
  CategoryCondition,
  FamilyConditionMode,
  ParcelFamily,
  TripLocationPoint,
} from "./create-trip.types";

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

// ─── Pricing PER_KG (D13/D14) ────────────────

function toCentsOrNull(value: number | ""): number | null {
  if (typeof value !== "number" || value <= 0) return null;
  return Math.round(value * 100);
}

export type ApiFamilyCondition = {
  familyKey: ParcelFamily;
  mode: FamilyConditionMode;
  surchargePct?: number;
};

export function mapFamilyConditionsForApi(
  conditions: Draft["familyConditions"]
): ApiFamilyCondition[] {
  return (Object.keys(conditions) as ParcelFamily[])
    .filter((key) => conditions[key].mode !== "ACCEPT")
    .map((key) => {
      const c = conditions[key];
      return c.mode === "SURCHARGE"
        ? { familyKey: key, mode: c.mode, surchargePct: c.surchargePct }
        : { familyKey: key, mode: c.mode };
    });
}

// ─── Location mapping ────────────────────────
//
// Le Draft stocke les TripLocationPoint avec des champs UI-only (`id`, `enabled`).
// Le backend attend juste { kind, details, flexibility, radiusKm }.
// On filtre les lieux activés et on strip le reste.
//
// Note: kind et flexibility sont déjà en SCREAMING_SNAKE_CASE côté frontend
// (AIRPORT, CITY_AREA, EXACT, RADIUS, CITY_WIDE) — pas de mapping à faire.

type ApiLocationPoint = {
  kind: string;
  details: string | null;
  flexibility: string;
  radiusKm: number | null;
};

function mapLocationsForApi(
  locations: TripLocationPoint[]
): ApiLocationPoint[] {
  return locations
    .filter((l) => l.enabled)
    .map((l) => ({
      kind: l.kind,
      details:
        l.details && l.details.trim().length > 0 ? l.details.trim() : null,
      flexibility: l.flexibility,
      // Defensive: only carry radiusKm when actually needed
      radiusKm: l.flexibility === "RADIUS" ? l.radiusKm ?? null : null,
    }));
}

// ─── Payload type ────────────────────────────

export type CreateTripPayload = {
  transportMode: string | null;
  tripType: string;

  // Origin
  originLabel: string | null;
  originPlaceId: string | null;
  originCity: string | null;
  originCityCode: string | null;
  originRegion: string | null;
  originRegionCode: string | null;
  originCountry: string | null;
  originCountryCode: string | null;
  originLat: number | null;
  originLng: number | null;

  // Destination
  destinationLabel: string | null;
  destinationPlaceId: string | null;
  destinationCity: string | null;
  destinationCityCode: string | null;
  destinationRegion: string | null;
  destinationRegionCode: string | null;
  destinationCountry: string | null;
  destinationCountryCode: string | null;
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

  // Conditions (legacy PER_CATEGORY — vide pour un trajet PER_KG neuf)
  acceptedCategories: string[];
  categoryConditions: Array<{
    category: string;
    priceAmountCents: number;
  }>;

  // ⭐ Moteur PER_KG (D13/D14/D19) — cents Int, jamais de float monétaire
  pricePerKgCents: number | null;
  capacityKg: number | null;
  checkedBag23PriceCents: number | null;
  cabinBag12PriceCents: number | null;
  familyConditions: ApiFamilyCondition[];

  // ⭐ Lieux de remise / livraison
  pickupLocations: ApiLocationPoint[];
  deliveryLocations: ApiLocationPoint[];

  handDeliveryOnly: boolean;
  instantBooking: boolean;
  currencyCode: string;
  notes: string | null;

  publish: boolean;
};

// ─── Mapper ──────────────────────────────────

export function mapDraftToPayload(
  draft: Draft,
  publish: boolean
): CreateTripPayload {
  const { fromPlace, toPlace } = draft;

  const resolvePrice = (condition: CategoryCondition): number => {
    if (draft.useGlobalPrice && typeof draft.globalPrice === "number") {
      return draft.globalPrice;
    }
    return typeof condition.priceAmount === "number"
      ? condition.priceAmount
      : 0;
  };

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
    originCityCode: fromPlace?.cityCode ?? null,
    originRegion: fromPlace?.region ?? null,
    originRegionCode: fromPlace?.regionCode ?? null,
    originCountry: fromPlace?.country ?? null,
    originCountryCode: fromPlace?.countryCode ?? null,
    originLat: fromPlace?.lat ?? null,
    originLng: fromPlace?.lng ?? null,

    // ── Destination ──
    destinationLabel: draft.to || null,
    destinationPlaceId: toPlace?.placeId ?? null,
    destinationCity: toPlace?.city ?? null,
    destinationCityCode: toPlace?.cityCode ?? null,
    destinationRegion: toPlace?.region ?? null,
    destinationRegionCode: toPlace?.regionCode ?? null,
    destinationCountry: toPlace?.country ?? null,
    destinationCountryCode: toPlace?.countryCode ?? null,
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

    // ── Conditions (simplified: just category + price) ──
    acceptedCategories: draft.acceptedCategories.map(mapCategory),
    categoryConditions: Object.values(draft.categoryConditions)
      .filter((c): c is CategoryCondition => !!c)
      .map((c) => ({
        category: mapCategory(c.categoryKey),
        priceAmountCents: Math.round(resolvePrice(c) * 100),
      })),

    // ── Moteur PER_KG ──
    pricePerKgCents: toCentsOrNull(draft.pricePerKg),
    capacityKg:
      typeof draft.capacityKg === "number" && draft.capacityKg > 0
        ? draft.capacityKg
        : null,
    checkedBag23PriceCents: toCentsOrNull(draft.checkedBag23Price),
    cabinBag12PriceCents: toCentsOrNull(draft.cabinBag12Price),
    familyConditions: mapFamilyConditionsForApi(draft.familyConditions),

    // ── Lieux de remise / livraison ──
    pickupLocations: mapLocationsForApi(draft.pickupLocations),
    deliveryLocations: mapLocationsForApi(draft.deliveryLocations),

    // ── Options ──
    handDeliveryOnly: draft.handDeliveryOnly,
    instantBooking: draft.instantBooking,
    currencyCode: draft.currencyCode,
    notes: draft.notes?.trim() || null,

    // ── Publish ──
    publish,
  };
}
