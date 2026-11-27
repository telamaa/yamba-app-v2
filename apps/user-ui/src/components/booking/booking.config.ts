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

/**
 * Le brouillon porte-t-il une saisie à perdre ?
 *
 * On ne demande pas confirmation pour rien : à l'ouverture, le brouillon porte
 * déjà une famille acceptée, un poids (2 kg par défaut, D33) et les lieux
 * pré-sélectionnés — sortir là n'efface RIEN de ce que l'utilisateur a tapé.
 * Ne comptent que les gestes qui lui appartiennent.
 */
export function hasUserInput(draft: Draft, initial: Draft): boolean {
  return (
    draft.description.trim() !== "" ||
    draft.declaredValueEur.trim() !== "" ||
    draft.photos.length > 0 ||
    draft.insurance !== initial.insurance ||
    draft.weightKg !== initial.weightKg ||
    draft.family !== initial.family ||
    draft.product !== initial.product ||
    draft.sizeClass !== initial.sizeClass ||
    draft.pickupLocationId !== initial.pickupLocationId ||
    draft.deliveryLocationId !== initial.deliveryLocationId ||
    draft.recipient.firstName.trim() !== "" ||
    draft.recipient.lastName.trim() !== "" ||
    draft.recipient.phoneE164.trim() !== "" ||
    draft.recipient.email.trim() !== "" ||
    draft.charterAccepted ||
    draft.termsAccepted
  );
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

/**
 * Le zéro de tête est-il un préfixe d'ACHEMINEMENT à retirer (D121) ?
 *
 * ── POURQUOI CETTE TABLE EXISTE ─────────────────────────────────────────
 * `toE164` retirait le zéro de tête partout, comme s'il s'agissait toujours
 * d'un préfixe d'acheminement. C'est vrai en France ou au Royaume-Uni ; au
 * Congo-Brazzaville et en Côte d'Ivoire, le 0 appartient au numéro de
 * l'abonné, et le retirer fabrique un numéro injoignable — par lequel le
 * DESTINATAIRE devait recevoir son code de livraison (D43). Le serveur ne
 * rattrape pas : il ne vérifie que la FORME E.164, que le numéro amputé
 * respecte parfaitement.
 *
 * ── CE QUI EST ÉTABLI, ET CE QUI NE L'EST PAS ───────────────────────────
 * **`false` n'est écrit que pour les pays ÉTABLIS** — avec, pour chacun, la
 * preuve en commentaire. Tout le reste vaut `true`, c'est-à-dire le
 * comportement d'avant ce lot : **on corrige ce qui est prouvé et on ne
 * change rien là où il faudrait deviner.** Une table remplie à l'intuition
 * casserait des pays qui marchent pour en réparer deux.
 *
 * Les entrées `true` ci-dessous ne sont donc PAS toutes des faits vérifiés :
 * certaines sont l'héritage. Elles sont sûres pour une raison simple — dans
 * ces pays, le numéro national ne commence pas par 0, donc retirer un zéro
 * ne retire rien ; et si l'utilisateur en tape un par habitude, le retirer
 * est le geste indulgent.
 */
export const ZERO_DACHEMINEMENT: Record<string, boolean> = {
  // ── ÉTABLIS : le 0 APPARTIENT au numéro, on le garde ──────────────────
  // Congo-Brazzaville : neuf chiffres commençant par 0 (05/06). Prouvé par
  // les données de recette du dépôt : `+242061234567`.
  CG: false,
  // Côte d'Ivoire : dix chiffres depuis 2021 (01/05/07), le 0 en fait
  // partie. C'est l'un des deux cas nommés par A223 le 23/10.
  CI: false,

  // ── ÉTABLIS : le 0 est un préfixe d'acheminement, on le retire ─────────
  // Prouvés par les données de recette : `+243812345678` (RD Congo, le 0 de
  // « 081 » disparaît), `+33612345601`, `+447712345604`, `+32471234606`,
  // `+84901234567`.
  CD: true,
  FR: true,
  GB: true,
  BE: true,
  VN: true,

  // ── HÉRITAGE : comportement d'avant D121, non revérifié ───────────────
  // Sûr en pratique : le numéro national n'y commence pas par 0, donc le
  // retrait ne retire rien ; et un 0 tapé par habitude est une faute de
  // frappe qu'on pardonne.
  CH: true,
  NL: true,
  DE: true,
  CM: true,
  GA: true,
  SN: true,
  ML: true,
  MA: true,
  DZ: true,
  TN: true,
  US: true,
  IN: true,
  CN: true,
};

/** Par défaut on retire : c'est le comportement d'avant ce lot. */
export function retireLeZero(code: string): boolean {
  return ZERO_DACHEMINEMENT[code] ?? true;
}

/** « +33 » + « 06 42 18 81 12 » → « +33642188112 » (E.164). Null si invalide. */
export function toE164(prefix: string, national: string, code?: string): string | null {
  const p = prefix.replace(/\D/g, '');
  let n = national.replace(/\D/g, '');
  if (!p || !n) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith(p)) n = n.slice(p.length);
  // D121 — UN zéro, et seulement s'il en est un. `^0+` amputait aussi les
  // fautes de frappe à deux zéros, et surtout il retirait le 0 des pays où
  // il appartient au numéro de l'abonné.
  const pays = code ?? paysDuPrefixe(prefix);
  if (n.startsWith('0') && (pays === undefined || retireLeZero(pays))) n = n.slice(1);
  const e164 = `+${p}${n}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

/**
 * Le pays d'un indicatif, quand il est unique dans la liste.
 *
 * `+1` couvre les États-Unis ET le Canada : l'entrée de la liste porte
 * « US », et les deux ont la même règle. Un indicatif inconnu rend
 * `undefined`, et l'appelant retombe sur le comportement par défaut.
 */
function paysDuPrefixe(prefix: string): string | undefined {
  const normalise = `+${prefix.replace(/\D/g, '')}`;
  return PHONE_PREFIXES.find((entree) => entree.prefix === normalise)?.code;
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

  if (isPerKgTrip(trip)) {
    // D14 — famille refusée par le Voyageur
    if (draft.product === "PARCEL" && trip.familyStances[draft.family]?.mode === "REFUSE") {
      errors.family = isFr
        ? "Le Voyageur ne prend pas cette famille de colis"
        : "The Traveler does not take this parcel family";
    }
    // PRC-04 — bagage entier non proposé
    if (draft.product === "CHECKED_BAG_23KG" && !trip.checkedBag23PriceCents) {
      errors.product = isFr ? "Bagage en soute non proposé sur ce trajet" : "Checked bag not offered on this trip";
    }
    if (draft.product === "CABIN_BAG_12KG" && !trip.cabinBag12PriceCents) {
      errors.product = isFr ? "Bagage cabine non proposé sur ce trajet" : "Cabin bag not offered on this trip";
    }
  } else if (!trip.acceptedCategories.includes(draft.category)) {
    errors.category = isFr
      ? "Catégorie non acceptée par le Voyageur"
      : "Category not accepted by the Traveler";
  }
  if (draft.product === "PARCEL") {
    const w = parseWeight(draft.weightKg);
    if (w === null) {
      errors.weightKg = isFr ? "Poids requis" : "Weight required";
    } else if (w > MAX_PARCEL_KG) {
      errors.weightKg = isFr
        ? `${MAX_PARCEL_KG} kg maximum par colis`
        : `${MAX_PARCEL_KG} kg max per parcel`;
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
      // ANO-WEB-33 (recette 5.12) — le mot « assurance » ne s'affiche nulle part : c'est une garantie.
      ? "Au moins 1 photo requise avec la Garantie Yamba 500 €"
      : "At least 1 photo required with the Yamba Guarantee €500";
  }

  return errors;
}

export function validateStep2(draft: Draft, trip: TripContext, isFr: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  // Les lieux de rendez-vous sont passés de l'étape 1 à l'étape 2 avec leur bloc
  // (revue UX 17/10) : la validation suit, sinon on bloque « Continuer » sur une
  // erreur invisible à l'écran.
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
      return validateStep2(draft, trip, isFr);
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

/** Plafond de poids par colis — exporté : l'écran en a besoin pour borner son pas. */
export const MAX_PARCEL_KG = 30;

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_SIZE_MB = 10;
