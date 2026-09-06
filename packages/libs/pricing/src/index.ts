/**
 * @packages/pricing — LE moteur de prix Expéditeur (D13/D14/D16/D22/D32, D34)
 * ============================================================================
 * Pur, sans dépendance, en CENTS entiers. Une seule implémentation pour :
 *   - le front (devis en direct dans le wizard de réservation, exemples),
 *   - le serveur (snapshot immuable du Booking à la création — D17, lot B2).
 * Les paramètres sont ceux du tableau §13 des règles métier ; ils seront
 * servis par l'API (`GET /pricing/params`) sans changer les formules.
 *
 *   billableKg = max(poids, MIN_BILLABLE_KG)                       (D32)
 *   transport  = max(round(€/kg × billableKg × coefTaille × (1 + surcharge)), MIN_TRANSPORT)
 *   commission = max(round(transport × COMMISSION_PCT), COMMISSION_FLOOR)   (D16)
 *   premium    = EXTENDED_500 → PROTECTION_EXTENDED_PREMIUM, sinon 0        (D22)
 *   total      = transport + commission + premium
 *   net Voyageur = transport (COM-03)
 *
 * Bagage entier (PRC-04) : transport = forfait du Voyageur, ni poids ni taille.
 */

export type SizeClass = "S" | "M" | "L";

/** Forme des paramètres du moteur — servis par les paramètres de la plateforme (D62), `PRICING_PARAMS` n'est que le défaut. */
export type PricingParams = {
  sizeCoef: Record<SizeClass, number>;
  minBillableKg: number;
  minTransportCents: number;
  commissionPct: number;
  commissionFloorCents: number;
  protectionExtendedPremiumCents: number;
  protectionExtendedCapCents: number;
  weightTolerancePct: number;
  referenceKg: number;
};

export const PRICING_PARAMS: PricingParams = {
  /** PRC-03 — classes de taille visuelles */
  sizeCoef: { S: 1, M: 1.1, L: 1.25 },
  /** D32 */
  minBillableKg: 0.5,
  minTransportCents: 800,
  /** D16 (acté mockup) */
  commissionPct: 12,
  commissionFloorCents: 300,
  /** D22 — Garantie Yamba jusqu'à 500 € */
  protectionExtendedPremiumCents: 600,
  protectionExtendedCapCents: 50000,
  /** PRC-07 */
  weightTolerancePct: 10,
  /** D33 — colis de référence pour la comparabilité */
  referenceKg: 2,
};

export type ProtectionTier = "BASIC" | "EXTENDED_500";
export type ParcelProduct = "PARCEL" | "CHECKED_BAG_23KG" | "CABIN_BAG_12KG";

export const BAG_KG: Record<Exclude<ParcelProduct, "PARCEL">, number> = {
  CHECKED_BAG_23KG: 23,
  CABIN_BAG_12KG: 12,
};

export type QuoteInput = {
  product: ParcelProduct;
  /** €/kg du Voyageur (cents) — requis pour PARCEL */
  pricePerKgCents?: number | null;
  /** forfaits du Voyageur (cents) — requis pour le produit bagage correspondant */
  checkedBag23PriceCents?: number | null;
  cabinBag12PriceCents?: number | null;
  weightKg?: number | null;
  sizeClass?: SizeClass | null;
  /** supplément de famille du Voyageur (D14/CAT-03), 0 si aucun */
  familySurchargePct?: number | null;
  protection?: ProtectionTier | null;
};

/** Le devis — chaque champ est fait pour être FIGÉ tel quel dans le snapshot D17. */
export type ShipperQuote = {
  product: ParcelProduct;
  pricingModel: "PER_KG" | "FLAT_BAG";
  weightKg: number | null;
  billableWeightKg: number | null;
  sizeClass: SizeClass | null;
  sizeCoef: number | null;
  pricePerKgCents: number | null;
  familySurchargePct: number;
  /** transport « brut » avant plancher — pour expliquer « minimum appliqué » */
  rawTransportCents: number;
  minimumApplied: boolean;
  transportCents: number;
  commissionPct: number;
  commissionCents: number;
  commissionFloorApplied: boolean;
  protectionTier: ProtectionTier;
  premiumCents: number;
  /** COM-03 : « Service & protection » = commission + prime */
  serviceCents: number;
  totalShipperCents: number;
  /** COM-03 : le net du Voyageur = le transport, point */
  carrierNetCents: number;
  /** kilos consommés sur la capacité (bagage entier = sa franchise) */
  capacityKgConsumed: number;
  currencyCode: "EUR";
};

export class QuoteError extends Error {
  constructor(public code: "MISSING_PRICE_PER_KG" | "MISSING_WEIGHT" | "MISSING_SIZE" | "BAG_NOT_OFFERED", message: string) {
    super(message);
  }
}

export function quoteShipperPrice(input: QuoteInput, p: PricingParams = PRICING_PARAMS): ShipperQuote {
  const protection: ProtectionTier = input.protection ?? "BASIC";
  const premiumCents = protection === "EXTENDED_500" ? p.protectionExtendedPremiumCents : 0;

  let rawTransportCents: number;
  let pricingModel: ShipperQuote["pricingModel"];
  let weightKg: number | null = null;
  let billableWeightKg: number | null = null;
  let sizeClass: SizeClass | null = null;
  let sizeCoef: number | null = null;
  let pricePerKgCents: number | null = null;
  let familySurchargePct = 0;
  let capacityKgConsumed: number;

  if (input.product === "PARCEL") {
    if (!(typeof input.pricePerKgCents === "number" && input.pricePerKgCents > 0)) {
      throw new QuoteError("MISSING_PRICE_PER_KG", "This trip has no price per kg.");
    }
    if (!(typeof input.weightKg === "number" && input.weightKg > 0)) {
      throw new QuoteError("MISSING_WEIGHT", "A positive weight is required.");
    }
    if (!input.sizeClass) {
      throw new QuoteError("MISSING_SIZE", "A size class (S/M/L) is required.");
    }
    pricingModel = "PER_KG";
    pricePerKgCents = input.pricePerKgCents;
    weightKg = input.weightKg;
    billableWeightKg = Math.max(input.weightKg, p.minBillableKg);
    sizeClass = input.sizeClass;
    sizeCoef = p.sizeCoef[input.sizeClass];
    familySurchargePct = Math.max(0, input.familySurchargePct ?? 0);
    rawTransportCents = Math.round(pricePerKgCents * billableWeightKg * sizeCoef * (1 + familySurchargePct / 100));
    capacityKgConsumed = input.weightKg;
  } else {
    const flat = input.product === "CHECKED_BAG_23KG" ? input.checkedBag23PriceCents : input.cabinBag12PriceCents;
    if (!(typeof flat === "number" && flat > 0)) {
      throw new QuoteError("BAG_NOT_OFFERED", "This trip does not offer that whole-bag flat rate.");
    }
    pricingModel = "FLAT_BAG";
    rawTransportCents = flat;
    capacityKgConsumed = BAG_KG[input.product];
  }

  const minimumApplied = rawTransportCents < p.minTransportCents;
  const transportCents = Math.max(rawTransportCents, p.minTransportCents);
  const rawCommission = Math.round((transportCents * p.commissionPct) / 100);
  const commissionFloorApplied = rawCommission < p.commissionFloorCents;
  const commissionCents = Math.max(rawCommission, p.commissionFloorCents);
  const serviceCents = commissionCents + premiumCents;

  return {
    product: input.product,
    pricingModel,
    weightKg,
    billableWeightKg,
    sizeClass,
    sizeCoef,
    pricePerKgCents,
    familySurchargePct,
    rawTransportCents,
    minimumApplied,
    transportCents,
    commissionPct: p.commissionPct,
    commissionCents,
    commissionFloorApplied,
    protectionTier: protection,
    premiumCents,
    serviceCents,
    totalShipperCents: transportCents + serviceCents,
    carrierNetCents: transportCents,
    capacityKgConsumed,
    currencyCode: "EUR",
  };
}
