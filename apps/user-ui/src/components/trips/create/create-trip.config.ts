import type { CategoryCondition, Draft, HandoffMoment, ParcelCategory, PickupMoment } from "./create-trip.types";

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

const DEFAULT_HANDOFF: HandoffMoment[] = ["beforeDeparture", "atDeparture"];
const DEFAULT_PICKUP: PickupMoment[] = ["onArrival"];

export function createDefaultCategoryCondition(
  categoryKey: ParcelCategory
): CategoryCondition {
  return {
    categoryKey,
    priceAmount: "",
    handoffMoments: [...DEFAULT_HANDOFF],
    pickupMoments: [...DEFAULT_PICKUP],
  };
}

/* ── Revenue estimation ──────────────────── */

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
    departureDate: isFr ? "Date requise" : "Date required",
    arrivalDate: isFr ? "Date requise" : "Date required",
    departureTime: isFr ? "Heure requise" : "Time required",
    arrivalTime: isFr ? "Heure requise" : "Time required",
    flightLayoverCities: isFr ? "Précisez la ville d'escale" : "Specify layover city",
    trainStopCities: isFr ? "Précisez la ville" : "Specify the city",
    categories: isFr ? "Sélectionnez au moins 1 catégorie" : "Select at least 1 category",
    priceZero: isFr ? "Le prix doit être supérieur à 0" : "Price must be greater than 0",
    priceEmpty: isFr ? "Prix requis" : "Price required",
    handoff: isFr ? "Sélectionnez au moins 1 moment" : "Select at least 1 option",
    pickup: isFr ? "Sélectionnez au moins 1 moment" : "Select at least 1 option",
  };
}

export function validateStep1(draft: Draft, isFr: boolean): ValidationErrors {
  const msgs = getValidationErrorsFr(isFr);
  const errors: ValidationErrors = {};

  if (!draft.transportMode) errors.transportMode = msgs.transportMode;
  if (!draft.from) errors.from = msgs.from;
  if (!draft.to) errors.to = msgs.to;
  if (!draft.departureDate) errors.departureDate = msgs.departureDate;
  if (!draft.arrivalDate) errors.arrivalDate = msgs.arrivalDate;
  if (!draft.departureTime) errors.departureTime = msgs.departureTime;
  if (!draft.arrivalTime) errors.arrivalTime = msgs.arrivalTime;

  if (draft.transportMode === "plane" && !draft.flightType) errors.flightType = msgs.flightType;
  if (draft.transportMode === "train" && !draft.trainTripType) errors.trainTripType = msgs.trainTripType;
  if (draft.transportMode === "car" && !draft.carTripFlexibility) errors.carTripFlexibility = msgs.carTripFlexibility;

  if (draft.transportMode === "plane" && draft.flightType === "withLayover" && !draft.flightLayoverCities.trim()) {
    errors.flightLayoverCities = msgs.flightLayoverCities;
  }
  if (
    draft.transportMode === "train" &&
    (draft.trainTripType === "withConnection" || draft.trainTripType === "withIntermediateStops") &&
    !draft.trainStopCities.trim()
  ) {
    errors.trainStopCities = msgs.trainStopCities;
  }

  return errors;
}

export function validateStep2(draft: Draft, isFr: boolean): ValidationErrors {
  const msgs = getValidationErrorsFr(isFr);
  const errors: ValidationErrors = {};

  if (draft.acceptedCategories.length === 0) {
    errors.categories = msgs.categories;
  }

  draft.acceptedCategories.forEach((key) => {
    const c = draft.categoryConditions[key];
    if (!c || c.priceAmount === "") {
      errors[`price_${key}`] = msgs.priceEmpty;
    } else if (Number(c.priceAmount) <= 0) {
      errors[`price_${key}`] = msgs.priceZero;
    }
    if (c && c.handoffMoments.length === 0) {
      errors[`handoff_${key}`] = msgs.handoff;
    }
    if (c && c.pickupMoments.length === 0) {
      errors[`pickup_${key}`] = msgs.pickup;
    }
  });

  return errors;
}

export function canContinueStep(step: number, draft: Draft, isFr: boolean): boolean {
  if (step === 1) return Object.keys(validateStep1(draft, isFr)).length === 0;
  if (step === 2) return Object.keys(validateStep2(draft, isFr)).length === 0;
  return true;
}

/* ── Auto-save ───────────────────────────── */

const DRAFT_STORAGE_KEY = "yamba_trip_draft";

export function saveDraftToStorage(draft: unknown) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch { /* silent */ }
}

export function loadDraftFromStorage(): unknown | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch { /* silent */ }
}
