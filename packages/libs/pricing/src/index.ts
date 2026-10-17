/**
 * @packages/pricing — LE moteur de prix Expéditeur (D13/D14/D16/D22/D32, D34)
 * ============================================================================
 * Pur, sans dépendance, en CENTS entiers. Une seule implémentation pour :
 *   - le front (devis en direct dans le wizard de réservation, exemples),
 *   - le serveur (snapshot immuable du Booking à la création — D17, lot B2).
 * Les paramètres sont ceux du tableau §13 des règles métier ; ils seront
 * servis par l'API (`GET /pricing/params`) sans changer les formules.
 *
 *   billableKg = max(poids, PLANCHER_KG, MIN_TAILLE_KG)             (D81)
 *   transport  = round(€/kg × billableKg × (1 + surcharge))
 *   commission = max(round(transport × COMMISSION_PCT), COMMISSION_FLOOR)   (D16)
 *   premium    = EXTENDED_500 → PROTECTION_EXTENDED_PREMIUM, sinon 0        (D22)
 *   total      = transport + commission + premium
 *   net Voyageur = transport (COM-03)
 *
 * Bagage entier (PRC-04) : transport = forfait du Voyageur, ni poids ni taille.
 *
 * D81 (17/10/2026) — LE POIDS FACTURÉ REMPLACE LE COEFFICIENT DE TAILLE.
 * ---------------------------------------------------------------------
 * On facture **le plus grand des trois : ce que ça pèse, la place que ça prend,
 * ou le minimum du trajet**. Ce qui a changé, et pourquoi :
 *   • le COEFFICIENT de taille (×1 / ×1,1 / ×1,25) disparaît. Mesuré : sous
 *     1,83 kg à 3,50 €/kg, S, M et L donnaient EXACTEMENT le même total, parce
 *     que le plancher de 8 € avalait le coefficient. On posait une question qui
 *     ne changeait rien ;
 *   • le PLANCHER passe en KILOS (2,3 kg) et remplace le minimum de 8 €. À
 *     3,50 €/kg il vaut 8,05 € — l'économie d'hier au centime près ; à 12 €/kg
 *     il vaut 27,60 €. Il devient proportionnel au corridor SANS paramètre
 *     supplémentaire, puisqu'il multiplie le tarif du Voyageur ;
 *   • chaque TAILLE porte un minimum de poids facturé (S aucun, M 3, L 6) —
 *     le poids volumétrique de l'express, pré-calculé une fois pour toutes,
 *     pour ne jamais demander trois dimensions (PRC-03 « pas besoin de
 *     mesurer »). S est le gabarit de référence : un minimum sur S
 *     renchérirait les petits objets de valeur que le plancher protège ;
 *   • la CAPACITÉ se décompte sur le poids FACTURÉ (CAP-01) : un colis L d'1 kg
 *     réserve 6 kg, c'est-à-dire la place qu'il prend. Avant, le volume était
 *     facturé sans jamais être réservé.
 * `billableReason` dit POURQUOI le poids facturé diffère du réel — un booléen
 * « minimum appliqué » ne permettait pas de l'expliquer.
 */

export type SizeClass = "S" | "M" | "L";

/** Forme des paramètres du moteur — servis par les paramètres de la plateforme (D62), `PRICING_PARAMS` n'est que le défaut. */
export type PricingParams = {
  /** D81 — plancher de facturation EN KILOS (il remplace l'ancien minimum en euros). */
  billingFloorKg: number;
  /** D81 — poids facturé minimum par classe de taille ; S vaut 0, par choix. */
  sizeMinKg: Record<SizeClass, number>;
  commissionPct: number;
  commissionFloorCents: number;
  protectionExtendedPremiumCents: number;
  protectionExtendedCapCents: number;
  weightTolerancePct: number;
  referenceKg: number;
};

export const PRICING_PARAMS: PricingParams = {
  /** D81 — 2,3 kg : à 3,50 €/kg cela vaut 8,05 €, l'économie d'avant au centime près */
  billingFloorKg: 2.3,
  /** D81 — PRC-03 sans coefficient : la taille impose un poids facturé minimum */
  sizeMinKg: { S: 0, M: 3, L: 6 },
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
  /** D81 — le plancher du trajet, en kilos, tel qu'appliqué (null : bagage entier) */
  billingFloorKg: number | null;
  /** D81 — le minimum de la taille choisie, en kilos (0 pour S) */
  sizeMinKg: number | null;
  /**
   * D81 — ce qui a DÉTERMINÉ le poids facturé. Un booléen « minimum appliqué »
   * ne disait pas lequel des trois avait gagné : on ne pouvait pas l'expliquer.
   */
  billableReason: "ACTUAL" | "FLOOR" | "SIZE_MIN" | null;
  pricePerKgCents: number | null;
  familySurchargePct: number;
  /** Ce que coûterait le POIDS RÉEL, sans plancher ni minimum de taille (D81). */
  rawTransportCents: number;
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
  let transportCents: number;
  let pricingModel: ShipperQuote["pricingModel"];
  let weightKg: number | null = null;
  let billableWeightKg: number | null = null;
  let sizeClass: SizeClass | null = null;
  let billingFloorKg: number | null = null;
  let sizeMinKg: number | null = null;
  let billableReason: ShipperQuote["billableReason"] = null;
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
    sizeClass = input.sizeClass;
    billingFloorKg = p.billingFloorKg;
    sizeMinKg = p.sizeMinKg[input.sizeClass];
    familySurchargePct = Math.max(0, input.familySurchargePct ?? 0);

    // D81 — le plus grand des trois, et on RETIENT lequel a gagné. L'ordre des
    // comparaisons porte la hiérarchie des explications : le poids réel d'abord
    // (le cas normal), puis la taille (le plus parlant quand elle décide), le
    // plancher du trajet en dernier.
    billableWeightKg = Math.max(input.weightKg, billingFloorKg, sizeMinKg);
    billableReason =
      billableWeightKg === input.weightKg
        ? "ACTUAL"
        : billableWeightKg === sizeMinKg
          ? "SIZE_MIN"
          : "FLOOR";

    const surcharge = 1 + familySurchargePct / 100;
    rawTransportCents = Math.round(pricePerKgCents * input.weightKg * surcharge);
    transportCents = Math.round(pricePerKgCents * billableWeightKg * surcharge);
    // CAP-01 (D81) — la place RÉSERVÉE est celle qu'on facture : un colis L d'1 kg
    // prend 6 kg dans le bagage, et le trajet doit le savoir.
    capacityKgConsumed = billableWeightKg;
  } else {
    const flat = input.product === "CHECKED_BAG_23KG" ? input.checkedBag23PriceCents : input.cabinBag12PriceCents;
    if (!(typeof flat === "number" && flat > 0)) {
      throw new QuoteError("BAG_NOT_OFFERED", "This trip does not offer that whole-bag flat rate.");
    }
    pricingModel = "FLAT_BAG";
    rawTransportCents = flat;
    transportCents = flat;
    capacityKgConsumed = BAG_KG[input.product];
  }

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
    billingFloorKg,
    sizeMinKg,
    billableReason,
    pricePerKgCents,
    familySurchargePct,
    rawTransportCents,
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
