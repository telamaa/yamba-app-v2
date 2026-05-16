/**
 * booking.config.ts
 * =================
 * Validation, pricing and step-progression logic. Pure functions.
 */

import type {
  Draft,
  ParcelCategory,
  PriceBreakdown,
  Step,
  TripContext,
  ValidationErrors,
} from "./booking.types";

const INSURANCE_PRICE_EXTENDED_500_EUR = 6;

export function computeTotal(draft: Draft, trip: TripContext): PriceBreakdown {
  const transport = trip.categoryPrices[draft.category] ?? 0;
  const serviceFee = round2(transport * trip.serviceFeePercent);
  const insurance =
    draft.insurance === "EXTENDED_500" ? INSURANCE_PRICE_EXTENDED_500_EUR : 0;
  const total = round2(transport + serviceFee + insurance);

  return {
    transport,
    serviceFee,
    insurance,
    total,
    currency: "EUR",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPhoneValid(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 8;
}

function isEmailValidOrEmpty(email: string): boolean {
  if (email.trim() === "") return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isPositiveNumber(s: string): boolean {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0;
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
  if (!trip.acceptedCategories.includes(draft.category)) {
    errors.category = isFr
      ? "Catégorie non acceptée par le voyageur"
      : "Category not accepted by the tripper";
  }
  if (!isPositiveNumber(draft.weightKg)) {
    errors.weightKg = isFr ? "Poids requis" : "Weight required";
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
  if (!isPhoneValid(draft.recipient.phoneE164)) {
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
export function getFirstAcceptedCategory(trip: TripContext): ParcelCategory {
  return trip.acceptedCategories[0] ?? "CLOTHES";
}

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_SIZE_MB = 10;
