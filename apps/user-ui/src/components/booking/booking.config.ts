/**
 * booking.config.ts
 * =================
 * Validation, pricing and step-progression logic. Pure functions.
 */

import { PRICING_PARAMS, QuoteError, quoteShipperPrice, type PricingParams } from "@packages/pricing";
import type {
  Draft,
  ParcelCategory,
  PriceBreakdown,
  Step,
  TripContext,
  ValidationErrors,
} from "./booking.types";

/** Poids saisi ("2,5") → nombre, ou null. */
export function parseWeight(s: string): number | null {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * D34 — le devis vient de `@packages/pricing` (même code que le snapshot
 * serveur) ; les euros ne servent qu'à l'affichage. Trajet legacy (sans
 * €/kg) : on retombe sur le prix par catégorie, sans devis figé.
 */
/** `params` : les valeurs servies par `GET /trips/pricing/params` (D62 7A) — défauts du moteur tant qu'elles ne sont pas là. */
export function computeTotal(draft: Draft, trip: TripContext, params: PricingParams = PRICING_PARAMS): PriceBreakdown {
  const isPerKg = typeof trip.pricePerKgCents === "number" && trip.pricePerKgCents > 0;
  if (isPerKg || draft.product !== "PARCEL") {
    try {
      const quote = quoteShipperPrice({
        product: draft.product,
        pricePerKgCents: trip.pricePerKgCents,
        checkedBag23PriceCents: trip.checkedBag23PriceCents,
        cabinBag12PriceCents: trip.cabinBag12PriceCents,
        weightKg: parseWeight(draft.weightKg),
        sizeClass: draft.sizeClass,
        familySurchargePct:
          trip.familyStances[draft.family]?.mode === "SURCHARGE" ? trip.familyStances[draft.family].surchargePct : 0,
        protection: draft.insurance,
      }, params);
      return {
        transport: quote.transportCents / 100,
        serviceFee: quote.commissionCents / 100,
        insurance: quote.premiumCents / 100,
        total: quote.totalShipperCents / 100,
        currency: "EUR",
        quote,
        quoteError: null,
      };
    } catch (e: unknown) {
      return { transport: 0, serviceFee: 0, insurance: 0, total: 0, currency: "EUR", quote: null, quoteError: e instanceof QuoteError ? e.code : "UNKNOWN" } as PriceBreakdown;
    }
  }
  // legacy PER_CATEGORY
  const transport = trip.categoryPrices[draft.category] ?? 0;
  const serviceFee = round2(Math.max(transport * (params.commissionPct / 100), params.commissionFloorCents / 100));
  const insurance = draft.insurance === "EXTENDED_500" ? params.protectionExtendedPremiumCents / 100 : 0;
  return { transport, serviceFee, insurance, total: round2(transport + serviceFee + insurance), currency: "EUR", quote: null, quoteError: null };
}

export function isPerKgTrip(trip: TripContext): boolean {
  return typeof trip.pricePerKgCents === "number" && trip.pricePerKgCents > 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Indicatifs proposés (marchés de lancement + diasporas) — ordre = fréquence attendue. */
export const PHONE_PREFIXES: Array<{ prefix: string; code: string; labelFr: string; labelEn: string }> = [
  { prefix: "+33", code: "FR", labelFr: "France", labelEn: "France" },
  { prefix: "+32", code: "BE", labelFr: "Belgique", labelEn: "Belgium" },
  { prefix: "+41", code: "CH", labelFr: "Suisse", labelEn: "Switzerland" },
  { prefix: "+44", code: "GB", labelFr: "Royaume-Uni", labelEn: "United Kingdom" },
  { prefix: "+31", code: "NL", labelFr: "Pays-Bas", labelEn: "Netherlands" },
  { prefix: "+49", code: "DE", labelFr: "Allemagne", labelEn: "Germany" },
  { prefix: "+242", code: "CG", labelFr: "Congo", labelEn: "Congo" },
  { prefix: "+243", code: "CD", labelFr: "RD Congo", labelEn: "DR Congo" },
  { prefix: "+237", code: "CM", labelFr: "Cameroun", labelEn: "Cameroon" },
  { prefix: "+241", code: "GA", labelFr: "Gabon", labelEn: "Gabon" },
  { prefix: "+221", code: "SN", labelFr: "Sénégal", labelEn: "Senegal" },
  { prefix: "+225", code: "CI", labelFr: "Côte d'Ivoire", labelEn: "Ivory Coast" },
  { prefix: "+223", code: "ML", labelFr: "Mali", labelEn: "Mali" },
  { prefix: "+212", code: "MA", labelFr: "Maroc", labelEn: "Morocco" },
  { prefix: "+213", code: "DZ", labelFr: "Algérie", labelEn: "Algeria" },
  { prefix: "+216", code: "TN", labelFr: "Tunisie", labelEn: "Tunisia" },
  { prefix: "+1", code: "US", labelFr: "États-Unis / Canada", labelEn: "United States / Canada" },
  { prefix: "+91", code: "IN", labelFr: "Inde", labelEn: "India" },
  { prefix: "+86", code: "CN", labelFr: "Chine", labelEn: "China" },
  { prefix: "+84", code: "VN", labelFr: "Viêt Nam", labelEn: "Vietnam" },
];

/** « +33 » + « 06 42 18 81 12 » → « +33642188112 » (E.164). Null si invalide. */
export function toE164(prefix: string, national: string): string | null {
  const p = prefix.replace(/\D/g, "");
  let n = national.replace(/\D/g, "");
  if (!p || !n) return null;
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith(p)) n = n.slice(p.length); // l'utilisateur a retapé l'indicatif
  n = n.replace(/^0+/, ""); // zéro national
  const e164 = `+${p}${n}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

export function recipientPhoneE164(draft: Draft): string | null {
  return toE164(draft.recipient.phonePrefix, draft.recipient.phoneE164);
}

function isPhoneValid(phone: string, prefix = "+33"): boolean {
  return toE164(prefix, phone) !== null;
}

function isEmailValidOrEmpty(email: string): boolean {
  if (email.trim() === "") return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isPositiveNumber(s: string): boolean {
  return parseWeight(s) !== null;
}

export function validateStep1(
  draft: Draft,
  trip: TripContext,
  isFr: boolean
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (trip.pickupOptions.length > 1 && !draft.pickupLocationId) {
    errors.pickupLocationId = isFr
      ? "Choisis un lieu de remise"
      : "Pick a handover location";
  }
  if (trip.deliveryOptions.length > 1 && !draft.deliveryLocationId) {
    errors.deliveryLocationId = isFr
      ? "Choisis un lieu de retrait"
      : "Pick a pickup location for the recipient";
  }
  if (isPerKgTrip(trip)) {
    // D14 — famille refusée par le Voyageur
    if (draft.product === "PARCEL" && trip.familyStances[draft.family]?.mode === "REFUSE") {
      errors.family = isFr
        ? "Le voyageur ne prend pas cette famille de colis"
        : "The tripper does not take this parcel family";
    }
    // PRC-04 — bagage entier non proposé
    if (draft.product === "CHECKED_BAG_23KG" && !trip.checkedBag23PriceCents) {
      errors.product = isFr ? "Bagage soute non proposé sur ce trajet" : "Checked bag not offered on this trip";
    }
    if (draft.product === "CABIN_BAG_12KG" && !trip.cabinBag12PriceCents) {
      errors.product = isFr ? "Bagage cabine non proposé sur ce trajet" : "Cabin bag not offered on this trip";
    }
  } else if (!trip.acceptedCategories.includes(draft.category)) {
    errors.category = isFr
      ? "Catégorie non acceptée par le voyageur"
      : "Category not accepted by the tripper";
  }
  if (draft.product === "PARCEL") {
    const w = parseWeight(draft.weightKg);
    if (w === null) {
      errors.weightKg = isFr ? "Poids requis" : "Weight required";
    } else if (w > 30) {
      errors.weightKg = isFr ? "30 kg maximum par colis" : "30 kg max per parcel";
    } else if (typeof trip.remainingKg === "number" && w > trip.remainingKg) {
      // CAP-01 — vérifié aussi côté serveur à la réservation
      errors.weightKg = isFr
        ? `Il ne reste que ${trip.remainingKg} kg disponibles sur ce trajet`
        : `Only ${trip.remainingKg} kg left on this trip`;
    }
  } else if (typeof trip.remainingKg === "number") {
    const need = draft.product === "CHECKED_BAG_23KG" ? 23 : 12;
    if (need > trip.remainingKg) {
      errors.product = isFr ? `Il ne reste que ${trip.remainingKg} kg : pas assez pour ce bagage` : `Only ${trip.remainingKg} kg left: not enough for this bag`;
    }
  }
  if (!isPositiveNumber(draft.declaredValueEur)) {
    errors.declaredValueEur = isFr
      ? "Valeur déclarée requise"
      : "Declared value required";
  }
  if (draft.description.trim().length < 5) {
    errors.description = isFr
      ? "Décris brièvement le contenu (min. 5 caractères)"
      : "Briefly describe the content (min. 5 chars)";
  }
  if (draft.insurance === "EXTENDED_500" && draft.photos.length === 0) {
    errors.photos = isFr
      ? "Au moins 1 photo requise avec l'assurance 500 €"
      : "At least 1 photo required with the 500 € insurance";
  }

  return errors;
}

export function validateStep2(draft: Draft, isFr: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  if (draft.recipient.firstName.trim() === "") {
    errors.recipientFirstName = isFr ? "Prénom requis" : "First name required";
  }
  if (draft.recipient.lastName.trim() === "") {
    errors.recipientLastName = isFr ? "Nom requis" : "Last name required";
  }
  if (!isPhoneValid(draft.recipient.phoneE164, draft.recipient.phonePrefix)) {
    errors.recipientPhoneE164 = isFr ? "Téléphone invalide" : "Invalid phone number";
  }
  if (!isEmailValidOrEmpty(draft.recipient.email)) {
    errors.recipientEmail = isFr ? "Email invalide" : "Invalid email";
  }

  return errors;
}

export function validateStep3(draft: Draft, isFr: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.charterAccepted) {
    errors.charterAccepted = isFr
      ? "Tu dois accepter la Charte Expéditeur"
      : "You must accept the Shipper Charter";
  }
  if (!draft.termsAccepted) {
    errors.termsAccepted = isFr
      ? "Tu dois accepter les CGV et le Contrat de transport"
      : "You must accept the Terms and the Transport Contract";
  }

  return errors;
}

export function validateStep(
  step: Step,
  draft: Draft,
  trip: TripContext,
  isFr: boolean
): ValidationErrors {
  switch (step) {
    case 1:
      return validateStep1(draft, trip, isFr);
    case 2:
      return validateStep2(draft, isFr);
    case 3:
      return validateStep3(draft, isFr);
    case 4:
      return {};
  }
}

export function canContinueStep(
  step: Step,
  draft: Draft,
  trip: TripContext,
  isFr: boolean
): boolean {
  return Object.keys(validateStep(step, draft, trip, isFr)).length === 0;
}

/** Pick a valid default category for the trip (first accepted). */
export function getFirstAcceptedFamily(trip: TripContext): Draft["family"] {
  const order: Draft["family"][] = ["CLOTHES_TEXTILE", "DOCUMENTS_PAPERS", "MISC_ACCESSORIES", "COSMETICS_CARE", "TOYS_CHILDCARE", "PARTS_TOOLS", "ELECTRONICS_DEVICES", "FOOD_DRY_SEALED"];
  return order.find((f) => trip.familyStances[f]?.mode !== "REFUSE") ?? "CLOTHES_TEXTILE";
}

export function getFirstAcceptedCategory(trip: TripContext): ParcelCategory {
  return trip.acceptedCategories[0] ?? "CLOTHES";
}

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_SIZE_MB = 10;
