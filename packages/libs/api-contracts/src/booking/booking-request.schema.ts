/**
 * booking-request.schema.ts — contrats d'ÉCRITURE de la demande (B2)
 * ==================================================================
 * Deux appels, dans cet ordre (D37) :
 *   1. POST /deals/payment-intents — le serveur recalcule le devis
 *      (@packages/pricing, D34) et AUTORISE le montant chez le
 *      PaymentProvider (D11). Réponse : clientSecret pour le Payment Element.
 *   2. POST /deals — même saisie + paymentIntentId : le serveur vérifie
 *      l'autorisation, recalcule le devis, refuse toute divergence (D17),
 *      réserve les kg (CAP-01) et crée le Booking PENDING + outbox, dans
 *      UNE transaction Mongo.
 *
 * `expectedTotalCents` = ce que l'Expéditeur a VU. Le serveur compare au
 * devis recalculé : différent ⇒ 409 QUOTE_DIVERGENCE (le front rafraîchit
 * et ré-affiche — jamais un débit d'un montant non vu).
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { LocationKindSchema } from "../trip/trip.enums";
import { ParcelFamilySchema } from "../trip/trip-pricing.schema";
import { ShipperPricingSchema } from "./booking.schema";
import { BookingStatusSchema } from "./booking.enums";

export const ParcelProductSchema = z
  .enum(["PARCEL", "CHECKED_BAG_23KG", "CABIN_BAG_12KG"])
  .meta({ id: "ParcelProduct", description: "PRC-04 — parcel priced per kg, or a whole bag at a flat rate" });
export type ParcelProduct = z.infer<typeof ParcelProductSchema>;

export const SizeClassSchema = z
  .enum(["S", "M", "L"])
  .meta({ id: "SizeClass", description: "PRC-03 — visual size class (coef 1 / 1.1 / 1.25)" });

export const ProtectionTierSchema = z
  .enum(["BASIC", "EXTENDED_500"])
  .meta({ id: "ProtectionTier", description: "GAR-02 — Yamba Guarantee tier (D22)" });

/** La partie « colis » qui détermine le prix (commune aux deux appels). */
export const BookingQuoteInputSchema = z
  .object({
    product: ParcelProductSchema,
    family: ParcelFamilySchema,
    sizeClass: SizeClassSchema.nullish().meta({ description: "Required for PARCEL" }),
    weightKg: z
      .number()
      .positive()
      .max(50)
      .nullish()
      .meta({ description: "Declared weight (kg) — required for PARCEL; ignored for bags" }),
    protection: ProtectionTierSchema.default("BASIC"),
  })
  .meta({ id: "BookingQuoteInput" });
export type BookingQuoteInput = z.infer<typeof BookingQuoteInputSchema>;

export const CreatePaymentIntentRequestSchema = BookingQuoteInputSchema.extend({
  tripId: ObjectIdSchema,
  expectedTotalCents: z.number().int().positive().meta({ description: "Total the shipper saw (D17 check)" }),
}).meta({ id: "CreatePaymentIntentRequest" });
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>;

export const PaymentProviderNameSchema = z
  .enum(["STRIPE", "FAKE"])
  .meta({ id: "PaymentProviderName", description: "FAKE only outside production (D11/D30)" });

export const CreatePaymentIntentResponseSchema = z
  .object({
    provider: PaymentProviderNameSchema,
    paymentIntentId: z.string(),
    clientSecret: z.string().nullable().meta({ description: "null for the FAKE provider" }),
    amountCents: z.number().int(),
    currencyCode: z.string(),
    quote: ShipperPricingSchema.meta({ description: "Server-side quote — what will be frozen (D17/D34)" }),
  })
  .meta({ id: "CreatePaymentIntentResponse" });
export type CreatePaymentIntentResponse = z.infer<typeof CreatePaymentIntentResponseSchema>;

export const BookingPlaceInputSchema = z
  .object({
    kind: LocationKindSchema,
    details: z.string().max(200).nullish(),
  })
  .meta({ id: "BookingPlaceInput", description: "Chosen among the trip's pickup/delivery points" });

export const CreateBookingRequestSchema = BookingQuoteInputSchema.extend({
  tripId: ObjectIdSchema,
  paymentIntentId: z.string().min(1),
  expectedTotalCents: z.number().int().positive(),
  description: z.string().trim().min(5).max(500).meta({ description: "Min 5 — same floor as the wizard (spec: recommended, low friction)" }),
  declaredValueCents: z.number().int().nonnegative().max(50_000_00),
  photoUrls: z.array(z.string().url()).max(5).default([]),
  recipient: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 expected"),
    email: z.string().trim().email().nullish().meta({ description: "Optional — recipient notifications only when provided" }),
  }),
  pickupPlace: BookingPlaceInputSchema.nullish(),
  deliveryPlace: BookingPlaceInputSchema.nullish(),
  charterAccepted: z.literal(true).meta({ description: "Shipper charter (CNF-02) — must be true" }),
  termsAccepted: z.literal(true),
}).meta({ id: "CreateBookingRequest" });
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const CreateBookingResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: BookingStatusSchema,
    expiresAt: z.iso.datetime().meta({ description: "24h acceptance deadline (DEA-01)" }),
    totalShipperCents: z.number().int(),
    currencyCode: z.string(),
  })
  .meta({ id: "CreateBookingResponse" });
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;

/** Codes d'erreur métier renvoyés en 409 (ConflictError) — le front traduit. */
export const BOOKING_REQUEST_ERROR_CODES = [
  "QUOTE_DIVERGENCE",
  "CAPACITY_EXCEEDED",
  "FAMILY_REFUSED",
  "TRIP_NOT_BOOKABLE",
  "OWN_TRIP",
  "PAYMENT_NOT_AUTHORIZED",
  "PAYMENT_MISMATCH",
  "PAYMENT_ALREADY_USED",
] as const;
export type BookingRequestErrorCode = (typeof BOOKING_REQUEST_ERROR_CODES)[number];
