/**
 * booking-wallet.schema.ts — le portefeuille (Finances) des deux rôles (A83)
 * ==========================================================================
 * Emplacement : packages/libs/api-contracts/src/booking/booking-wallet.schema.ts
 *
 * `GET /me/wallet` : totaux calculés SERVEUR (décision utilisateur 2A) et
 * lignes par deal, pour le Voyageur (versements) et l'Expéditeur
 * (paiements). Chaque ligne porte UN montant en cents entiers + devise
 * (D18) et un état de vocabulaire produit — le front reflète, ne
 * recalcule rien.
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { BookingStatusSchema } from "./booking.enums";

const corridor = z.object({ originCity: z.string(), destinationCity: z.string() });

/* ══ Voyageur — versements ════════════════════════════════════ */

export const WALLET_PAYOUT_STATES = ["UPCOMING", "PENDING", "BLOCKED", "FROZEN", "SENT", "HELD", "REVERSED"] as const;
export const WalletPayoutStateSchema = z.enum(WALLET_PAYOUT_STATES).meta({
  id: "WalletPayoutState",
  description:
    "UPCOMING = delivered, shipper verification running (payoutDueAt) · PENDING = being sent / retried · " +
    "BLOCKED = carrier Stripe account not ready (CTA onboarding) · FROZEN = dispute open · SENT = transfer executed " +
    "(payoutSentAt) · HELD = late cancellation after departure, retention held for mediation (no amount) · " +
    "REVERSED = Stripe reversed the transfer, under review (A87)",
});

export const WalletPayoutItemSchema = z
  .object({
    bookingId: ObjectIdSchema,
    tripId: ObjectIdSchema,
    bookingStatus: BookingStatusSchema,
    corridor,
    counterpartFirstName: z.string().nullable().meta({ description: "Shipper first name (null if account deleted)" }),
    kind: z.enum(["DELIVERY", "LATE_CANCELLATION"]).meta({ description: "Net for a delivery, or ANN-01 compensation" }),
    state: WalletPayoutStateSchema,
    amountCents: z.number().int().nullable().meta({ description: "null for HELD (nothing decided yet)" }),
    currencyCode: z.string(),
    date: z.iso.datetime().nullable().meta({ description: "UPCOMING: payoutDueAt · SENT: payoutSentAt · else: last update" }),
  })
  .meta({ id: "WalletPayoutItem" });
export type WalletPayoutItem = z.infer<typeof WalletPayoutItemSchema>;

export const CarrierWalletSchema = z
  .object({
    upcomingCents: z.number().int().meta({ description: "Σ UPCOMING" }),
    pendingCents: z.number().int().meta({ description: "Σ PENDING + BLOCKED + FROZEN" }),
    blockedCents: z.number().int().meta({ description: "Σ BLOCKED — drives the 'finish your Stripe account' banner" }),
    sentCents: z.number().int().meta({ description: "Σ SENT, all time" }),
    sentThisMonthCents: z.number().int().meta({ description: "Σ SENT with payoutSentAt in the current calendar month (UTC)" }),
    currencyCode: z.string(),
    items: z.array(WalletPayoutItemSchema).meta({ description: "Most recent first" }),
  })
  .meta({ id: "CarrierWallet" });
export type CarrierWallet = z.infer<typeof CarrierWalletSchema>;

/* ══ Expéditeur — paiements ═══════════════════════════════════ */

export const WALLET_PAYMENT_STATES = ["AUTHORIZED", "HELD", "RELEASED", "RELEASED_NO_CHARGE", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
export const WalletPaymentStateSchema = z.enum(WALLET_PAYMENT_STATES).meta({
  id: "WalletPaymentState",
  description:
    "AUTHORIZED = hold placed, nothing debited (PENDING request) · HELD = captured, kept by Yamba until completion " +
    "(ACCEPTED/PICKED_UP/DELIVERED/DISPUTED) · RELEASED = completed, carrier paid · RELEASED_NO_CHARGE = declined / expired / " +
    "cancelled before capture, the hold simply vanished · REFUNDED = captured then refunded in full · PARTIALLY_REFUNDED = " +
    "late cancellation, ANN-01 retention kept",
});

export const WalletPaymentItemSchema = z
  .object({
    bookingId: ObjectIdSchema,
    tripId: ObjectIdSchema,
    bookingStatus: BookingStatusSchema,
    corridor,
    counterpartFirstName: z.string().nullable().meta({ description: "Carrier first name (null if account deleted)" }),
    state: WalletPaymentStateSchema,
    amountCents: z.number().int().meta({ description: "Total charged (or authorized) to the shipper" }),
    refundAmountCents: z.number().int().nullable().meta({ description: "REFUNDED / PARTIALLY_REFUNDED: amount returned" }),
    retentionCents: z.number().int().nullable().meta({ description: "PARTIALLY_REFUNDED: amount kept (ANN-01)" }),
    currencyCode: z.string(),
    date: z.iso.datetime().nullable().meta({ description: "HELD (delivered): payoutDueAt · RELEASED: completedAt · REFUNDED: refundedAt · else: requestedAt" }),
  })
  .meta({ id: "WalletPaymentItem" });
export type WalletPaymentItem = z.infer<typeof WalletPaymentItemSchema>;

export const ShipperWalletSchema = z
  .object({
    heldCents: z.number().int().meta({ description: "Σ HELD — captured, not yet settled" }),
    spentCents: z.number().int().meta({ description: "Σ RELEASED totals + retentions of PARTIALLY_REFUNDED" }),
    refundedCents: z.number().int().meta({ description: "Σ refunds actually returned (REFUNDED + PARTIALLY_REFUNDED)" }),
    currencyCode: z.string(),
    items: z.array(WalletPaymentItemSchema).meta({ description: "Most recent first" }),
  })
  .meta({ id: "ShipperWallet" });
export type ShipperWallet = z.infer<typeof ShipperWalletSchema>;

export const WalletResponseSchema = z
  .object({
    success: z.literal(true),
    carrier: CarrierWalletSchema,
    shipper: ShipperWalletSchema,
    generatedAt: z.iso.datetime(),
  })
  .meta({ id: "WalletResponse", description: "Finances page — both roles, totals computed server-side (A83)" });
export type WalletResponse = z.infer<typeof WalletResponseSchema>;
