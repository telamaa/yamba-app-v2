import type {
  CategoryCondition,
  Draft,
  FamilyConditionDraft,
  ParcelCategory,
  ParcelFamily,
  TransportMode,
  TripLocationPoint,
} from "./create-trip.types";

/* ── Familles de colis (D14 / CAT-02) ──────
 * Liste FIGÉE, miroir de ParcelFamilySchema (api-contracts). L'ordre est
 * celui d'affichage du formulaire (mockup-pricing-yamba.html).
 * ──────────────────────────────────────── */

export type FamilyIconKey =
  | "file-text" | "shirt" | "package" | "smartphone"
  | "sparkles" | "wrench" | "baby" | "shopping-bag";

export type ParcelFamilyOption = {
  key: ParcelFamily;
  icon: FamilyIconKey;
  labelFr: string;
  labelEn: string;
};

/** Icônes Lucide (rendu uniforme iOS/Android/desktop, colorables à la charte)
 *  — jamais d'emoji : rendu OS-dépendant, non thémable. */
export const PARCEL_FAMILIES: ParcelFamilyOption[] = [
  { key: "DOCUMENTS_PAPERS", icon: "file-text", labelFr: "Documents & papiers", labelEn: "Documents & papers" },
  { key: "CLOTHES_TEXTILE", icon: "shirt", labelFr: "Vêtements & textile", labelEn: "Clothes & textile" },
  { key: "FOOD_DRY_SEALED", icon: "package", labelFr: "Alimentaire sec & scellé", labelEn: "Dry sealed food" },
  { key: "ELECTRONICS_DEVICES", icon: "smartphone", labelFr: "Électronique & appareils", labelEn: "Electronics & devices" },
  { key: "COSMETICS_CARE", icon: "sparkles", labelFr: "Cosmétiques & soins", labelEn: "Cosmetics & care" },
  { key: "PARTS_TOOLS", icon: "wrench", labelFr: "Pièces & outillage", labelEn: "Parts & tools" },
  { key: "TOYS_CHILDCARE", icon: "baby", labelFr: "Jouets & puériculture", labelEn: "Toys & childcare" },
  { key: "MISC_ACCESSORIES", icon: "shopping-bag", labelFr: "Accessoires & divers", labelEn: "Accessories & misc." },
];

export const DEFAULT_SURCHARGE_PCT = 20;

export function createDefaultFamilyConditions(): Record<ParcelFamily, FamilyConditionDraft> {
  return Object.fromEntries(
    PARCEL_FAMILIES.map((f) => [f.key, { mode: "ACCEPT", surchargePct: DEFAULT_SURCHARGE_PCT }])
  ) as Record<ParcelFamily, FamilyConditionDraft>;
}

/* ── Bornes des curseurs (mockup) ────────── */

export const PRICE_PER_KG_RANGE = { min: 5, max: 20, step: 0.5 } as const;
export const CAPACITY_KG_RANGE = { min: 2, max: 30, step: 1 } as const;
export const SURCHARGE_PCT_RANGE = { min: 5, max: 50, step: 5 } as const;

/** PRC-04 — un bagage entier consomme sa franchise complète de capacité. */
export const CHECKED_BAG_KG = 23;
export const CABIN_BAG_KG = 12;

/** D13 — tolérance de poids au pickup (paramètre serveur §13, affiché à titre indicatif). */
export const PICKUP_WEIGHT_TOLERANCE_PCT = 10;

/** Capacité proposée par défaut à l'arrivée sur l'étape 2 (mockup : 12 kg). */
export const DEFAULT_CAPACITY_KG = 12;

/* ── Suggestion de prix — D15 V1 déterministe (PRC-05) ──
 * prixSuggéré(€/kg) = base_corridor × modificateurs, EXPLICABLE : chaque
 * modificateur actif est renvoyé dans `factors` (popover « Pourquoi ce
 * prix ? »). V1 : base unique (pas encore de table base_corridor ni de
 * signal SavedRoutes) — le moteur est pur pour être remplacé par un appel
 * serveur sans toucher l'UI (la jauge ne connaît que { low, median, high }).
 *
 * Sens du facteur « délai » : côté OFFRE (le Voyageur), un départ imminent
 * laisse moins de temps pour vendre ses kilos → la suggestion BAISSE.
 * (La prime d'urgence existe côté demande, pas ici.)
 * ──────────────────────────────────────── */

export const PRICE_SUGGESTION_V1 = {
  baseCorridorPerKg: 11,
  lowPct: 10,
  highPct: 15,
  directFlightMod: 0.05,
  departureWithin3DaysMod: -0.05,
  departureWithin7DaysMod: -0.02,
} as const;

export type PriceFactor = {
  key: "base" | "directFlight" | "departureSoon";
  /** variation en % appliquée (0 pour la base) */
  pct: number;
  /** valeur de base en €/kg (key = base) */
  value?: number;
};

export type PriceSuggestion = {
  low: number;
  median: number;
  high: number;
  factors: PriceFactor[];
};

/** Arrondi commercial au 0,50 € (les Voyageurs affichent 11,50 — pas 11,47). */
export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function suggestPricePerKg(
  draft: Pick<Draft, "transportMode" | "flightType" | "departureDate">
): PriceSuggestion {
  const p = PRICE_SUGGESTION_V1;
  const factors: PriceFactor[] = [{ key: "base", pct: 0, value: p.baseCorridorPerKg }];
  let median = p.baseCorridorPerKg;

  if (draft.transportMode === "plane" && draft.flightType === "direct") {
    median *= 1 + p.directFlightMod;
    factors.push({ key: "directFlight", pct: p.directFlightMod * 100 });
  }

  if (draft.departureDate) {
    const days =
      (toDateOnly(new Date(draft.departureDate)).getTime() - toDateOnly(new Date()).getTime()) /
      86_400_000;
    const mod = days <= 3 ? p.departureWithin3DaysMod : days <= 7 ? p.departureWithin7DaysMod : 0;
    if (mod !== 0) {
      median *= 1 + mod;
      factors.push({ key: "departureSoon", pct: mod * 100 });
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    low: round(median * (1 - p.lowPct / 100)),
    median: round(median),
    high: round(median * (1 + p.highPct / 100)),
    factors,
  };
}

/** Résumé d'une ligne d'accordéon fermée : « Tout accepté » ou la liste des écarts. */
export function summarizeFamilyConditions(
  conditions: Draft["familyConditions"],
  isFr: boolean
): string | null {
  const parts = PARCEL_FAMILIES.filter((f) => conditions[f.key].mode !== "ACCEPT").map((f) => {
    const c = conditions[f.key];
    const label = isFr ? f.labelFr : f.labelEn;
    return c.mode === "REFUSE" ? `${label} : ${isFr ? "refusé" : "refused"}` : `${label} : +${c.surchargePct} %`;
  });
  return parts.length === 0 ? null : parts.join(" · ");
}

/** Un forfait bagage lu en €/kg — pour que le Voyageur voie s'il brade. */
export function bagEquivalentPerKg(price: number | "", kg: number): number | null {
  if (typeof price !== "number" || price <= 0) return null;
  return Math.round((price / kg) * 100) / 100;
}

export type FairPriceVerdict = "low" | "ok" | "high";

export function getFairPriceVerdict(price: number, s: PriceSuggestion): FairPriceVerdict {
  if (price < s.low) return "low";
  if (price > s.high) return "high";
  return "ok";
}

/* ── Gain net du Voyageur (D16 : son prix = son net) ──
 * Capacité entièrement vendue au €/kg — les forfaits bagages sont hors
 * de cette projection (ils consomment la même capacité).
 * ──────────────────────────────────────── */

export function estimateNetGain(draft: Pick<Draft, "pricePerKg" | "capacityKg">): number {
  const price = typeof draft.pricePerKg === "number" ? draft.pricePerKg : 0;
  const capacity = typeof draft.capacityKg === "number" ? draft.capacityKg : 0;
  if (price <= 0 || capacity <= 0) return 0;
  return Math.round(price * capacity * 100) / 100;
}

/* ── Category groups ─────────────────────── */

export type CategoryGroup = {
  labelFr: string;
  labelEn: string;
  items: ParcelCategory[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    labelFr: "Mode & accessoires",
    labelEn: "Fashion & accessories",
    items: ["clothes", "shoes", "fashionAccessories", "otherAccessories"],
  },
  {
    labelFr: "Tech & électronique",
    labelEn: "Tech & electronics",
    items: ["phone", "computer", "otherElectronics"],
  },
  {
    labelFr: "Autres",
    labelEn: "Other",
    items: ["books", "documents", "smallToys", "checkedBag23kg", "cabinBag12kg"],
  },
];

/* ── Smart defaults ──────────────────────── */

export function getSmartDefaultDepartureDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function getSmartDefaultTime(): string {
  const now = new Date();
  const nextHour = now.getHours() + 1;
  return `${String(nextHour % 24).padStart(2, "0")}:00`;
}

/* ── Default conditions per category ─────── */

export function createDefaultCategoryCondition(
  categoryKey: ParcelCategory
): CategoryCondition {
  return {
    categoryKey,
    priceAmount: "",
  };
}

/* ── Default locations per transport mode ─
 *
 * Generates the initial set of pickup/delivery cards when the user picks
 * a transport mode. Disabled cards stay in the array (greyed out in UI)
 * so the user can quickly enable them.
 *
 * Strategy:
 *   - Plane → Airport (enabled, EXACT) + City (disabled, RADIUS 10km)
 *   - Train → Train station (enabled, EXACT) + City (disabled, RADIUS 10km)
 *   - Car   → City only (enabled, RADIUS 10km)
 *
 * The Expéditeur sees only enabled cards in the final trip listing.
 * ──────────────────────────────────────── */

function makeLocId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDefaultLocationsForMode(
  mode: TransportMode | null
): { pickupLocations: TripLocationPoint[]; deliveryLocations: TripLocationPoint[] } {
  if (mode === "plane") {
    return {
      pickupLocations: [
        { id: makeLocId(), context: "PICKUP", kind: "AIRPORT", enabled: true, details: "", flexibility: "EXACT", radiusKm: null },
        { id: makeLocId(), context: "PICKUP", kind: "CITY_AREA", enabled: false, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
      deliveryLocations: [
        { id: makeLocId(), context: "DELIVERY", kind: "AIRPORT", enabled: true, details: "", flexibility: "EXACT", radiusKm: null },
        { id: makeLocId(), context: "DELIVERY", kind: "CITY_AREA", enabled: false, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
    };
  }

  if (mode === "train") {
    return {
      pickupLocations: [
        { id: makeLocId(), context: "PICKUP", kind: "TRAIN_STATION", enabled: true, details: "", flexibility: "EXACT", radiusKm: null },
        { id: makeLocId(), context: "PICKUP", kind: "CITY_AREA", enabled: false, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
      deliveryLocations: [
        { id: makeLocId(), context: "DELIVERY", kind: "TRAIN_STATION", enabled: true, details: "", flexibility: "EXACT", radiusKm: null },
        { id: makeLocId(), context: "DELIVERY", kind: "CITY_AREA", enabled: false, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
    };
  }

  if (mode === "car") {
    return {
      pickupLocations: [
        { id: makeLocId(), context: "PICKUP", kind: "CITY_AREA", enabled: true, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
      deliveryLocations: [
        { id: makeLocId(), context: "DELIVERY", kind: "CITY_AREA", enabled: true, details: "", flexibility: "RADIUS", radiusKm: 10 },
      ],
    };
  }

  return { pickupLocations: [], deliveryLocations: [] };
}

/* ── Revenue estimation (legacy PER_CATEGORY) ──
 * @deprecated remplacé par estimateNetGain — supprimé à la PR cleanup A28.
 * ──────────────────────────────────────── */

export function estimateRevenue(
  conditions: Partial<Record<ParcelCategory, CategoryCondition>>
): { min: number; max: number } {
  const prices = Object.values(conditions)
    .map((c) => (c && c.priceAmount !== "" ? Number(c.priceAmount) : 0))
    .filter((p) => p > 0);

  if (prices.length === 0) return { min: 0, max: 0 };

  const min = Math.min(...prices);
  const max = prices.reduce((sum, p) => sum + p, 0) * 3;
  return { min, max };
}

/* ── Date helpers ─────────────────────────── */

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isDateInPast(date: Date): boolean {
  const today = toDateOnly(new Date());
  return toDateOnly(date) < today;
}

function isArrivalBeforeDeparture(departure: Date, arrival: Date): boolean {
  return toDateOnly(arrival) < toDateOnly(departure);
}

/* ── Validation ──────────────────────────── */

export type ValidationErrors = Record<string, string>;

export function getValidationErrorsFr(isFr: boolean) {
  return {
    transportMode: isFr ? "Choisissez un mode" : "Choose a mode",
    flightType: isFr ? "Précisez le type" : "Specify the type",
    trainTripType: isFr ? "Précisez le type" : "Specify the type",
    carTripFlexibility: isFr ? "Précisez le type" : "Specify the type",
    from: isFr ? "Ville de départ requise" : "Departure city required",
    to: isFr ? "Ville d'arrivée requise" : "Arrival city required",
    fromPlace: isFr
      ? "Sélectionnez une ville dans la liste"
      : "Select a city from the list",
    toPlace: isFr
      ? "Sélectionnez une ville dans la liste"
      : "Select a city from the list",
    departureDate: isFr ? "Date requise" : "Date required",
    departureDatePast: isFr
      ? "La date de départ ne peut pas être dans le passé"
      : "Departure date cannot be in the past",
    arrivalDate: isFr ? "Date requise" : "Date required",
    arrivalDateBeforeDeparture: isFr
      ? "La date d'arrivée doit être après le départ"
      : "Arrival date must be after departure",
    departureTime: isFr ? "Heure requise" : "Time required",
    arrivalTime: isFr ? "Heure requise" : "Time required",
    flightLayoverCities: isFr ? "Précisez la ville d'escale" : "Specify layover city",
    trainStopCities: isFr ? "Précisez la ville" : "Specify the city",
    categories: isFr ? "Sélectionnez au moins 1 catégorie" : "Select at least 1 category",
    pricePerKgRequired: isFr ? "Fixez votre prix au kilo" : "Set your price per kg",
    pricePerKgZero: isFr ? "Le prix au kilo doit être supérieur à 0" : "Price per kg must be greater than 0",
    capacityRequired: isFr ? "Indiquez votre capacité en kg" : "Enter your capacity in kg",
    capacityZero: isFr ? "La capacité doit être supérieure à 0" : "Capacity must be greater than 0",
    surchargeInvalid: isFr ? "Surcharge entre 1 et 100 %" : "Surcharge between 1 and 100%",
    bagPriceZero: isFr ? "Le forfait doit être supérieur à 0" : "Flat rate must be greater than 0",
    bagNeedsCapacity: (kg: number) =>
      isFr ? `Nécessite une capacité d'au moins ${kg} kg` : `Requires a capacity of at least ${kg} kg`,
    priceZero: isFr ? "Le prix doit être supérieur à 0" : "Price must be greater than 0",
    priceEmpty: isFr ? "Prix requis" : "Price required",
    pickupLocationRequired: isFr
      ? "Activez au moins 1 lieu de remise"
      : "Enable at least 1 pickup location",
    deliveryLocationRequired: isFr
      ? "Activez au moins 1 lieu de livraison"
      : "Enable at least 1 delivery location",
    locationDetailsEmpty: isFr
      ? "Précisez le lieu"
      : "Specify the location",
  };
}

export function validateStep1(draft: Draft, isFr: boolean): ValidationErrors {
  const msgs = getValidationErrorsFr(isFr);
  const errors: ValidationErrors = {};

  if (!draft.transportMode) errors.transportMode = msgs.transportMode;

  if (!draft.from) {
    errors.from = msgs.from;
  } else if (!draft.fromPlace) {
    errors.from = msgs.fromPlace;
  }

  if (!draft.to) {
    errors.to = msgs.to;
  } else if (!draft.toPlace) {
    errors.to = msgs.toPlace;
  }

  if (!draft.departureDate) {
    errors.departureDate = msgs.departureDate;
  } else if (isDateInPast(draft.departureDate)) {
    errors.departureDate = msgs.departureDatePast;
  }

  if (!draft.arrivalDate) {
    errors.arrivalDate = msgs.arrivalDate;
  } else if (
    draft.departureDate &&
    isArrivalBeforeDeparture(draft.departureDate, draft.arrivalDate)
  ) {
    errors.arrivalDate = msgs.arrivalDateBeforeDeparture;
  }

  if (!draft.departureTime) errors.departureTime = msgs.departureTime;
  if (!draft.arrivalTime) errors.arrivalTime = msgs.arrivalTime;

  if (draft.transportMode === "plane" && !draft.flightType)
    errors.flightType = msgs.flightType;
  if (draft.transportMode === "train" && !draft.trainTripType)
    errors.trainTripType = msgs.trainTripType;
  if (draft.transportMode === "car" && !draft.carTripFlexibility)
    errors.carTripFlexibility = msgs.carTripFlexibility;

  if (
    draft.transportMode === "plane" &&
    draft.flightType === "withLayover" &&
    !draft.flightLayoverCities.trim()
  ) {
    errors.flightLayoverCities = msgs.flightLayoverCities;
  }
  if (
    draft.transportMode === "train" &&
    draft.trainTripType === "withConnection" &&
    !draft.trainStopCities.trim()
  ) {
    errors.trainStopCities = msgs.trainStopCities;
  }

  return errors;
}

export function validateStep2(draft: Draft, isFr: boolean): ValidationErrors {
  const msgs = getValidationErrorsFr(isFr);
  const errors: ValidationErrors = {};

  // ⭐ Moteur PER_KG (D13) — prix ET capacité (le gate A28 exige les deux)
  if (draft.pricePerKg === "") {
    errors.pricePerKg = msgs.pricePerKgRequired;
  } else if (Number(draft.pricePerKg) <= 0) {
    errors.pricePerKg = msgs.pricePerKgZero;
  }

  if (draft.capacityKg === "") {
    errors.capacityKg = msgs.capacityRequired;
  } else if (Number(draft.capacityKg) <= 0) {
    errors.capacityKg = msgs.capacityZero;
  }

  // Familles (D14) — une surcharge doit être un % valide (miroir superRefine contrat)
  for (const family of PARCEL_FAMILIES) {
    const c = draft.familyConditions[family.key];
    if (c?.mode === "SURCHARGE" && (!Number.isInteger(c.surchargePct) || c.surchargePct < 1 || c.surchargePct > 100)) {
      errors[`family_${family.key}`] = msgs.surchargeInvalid;
    }
  }

  // Bagages entiers (PRC-04) — optionnels, > 0 s'ils sont proposés, et la
  // capacité doit pouvoir les contenir (RG-B-29 — miroir du gate serveur)
  const capacity = typeof draft.capacityKg === "number" ? draft.capacityKg : 0;
  if (draft.checkedBag23Price !== "") {
    if (Number(draft.checkedBag23Price) <= 0) errors.checkedBag23Price = msgs.bagPriceZero;
    else if (capacity < CHECKED_BAG_KG) errors.checkedBag23Price = msgs.bagNeedsCapacity(CHECKED_BAG_KG);
  }
  if (draft.cabinBag12Price !== "") {
    if (Number(draft.cabinBag12Price) <= 0) errors.cabinBag12Price = msgs.bagPriceZero;
    else if (capacity < CABIN_BAG_KG) errors.cabinBag12Price = msgs.bagNeedsCapacity(CABIN_BAG_KG);
  }

  // Locations — at least 1 enabled per context
  const enabledPickup = draft.pickupLocations.filter((l) => l.enabled);
  const enabledDelivery = draft.deliveryLocations.filter((l) => l.enabled);

  if (enabledPickup.length === 0) {
    errors.pickupLocations = msgs.pickupLocationRequired;
  }
  if (enabledDelivery.length === 0) {
    errors.deliveryLocations = msgs.deliveryLocationRequired;
  }

  return errors;
}

export function canContinueStep(step: number, draft: Draft, isFr: boolean): boolean {
  if (step === 1) return Object.keys(validateStep1(draft, isFr)).length === 0;
  if (step === 2) return Object.keys(validateStep2(draft, isFr)).length === 0;
  return true;
}
