/**
 * booking-settlement.schema.ts — B4 « argent sortant » : confirmation anticipée, litige
 * =====================================================================================
 * Emplacement : packages/libs/api-contracts/src/booking/booking-settlement.schema.ts
 *
 * Contrats de `POST /deals/:id/confirm` (Expéditeur, DELIVERED → COMPLETED,
 * INV-3 : définitif) et `POST /deals/:id/dispute` (Expéditeur, DELIVERED →
 * DISPUTED avant J+4, INV-4 : irréversible). Le versement lui-même n'a pas
 * de route : il est exécuté par le serveur (D49) et se lit dans
 * `payoutStatus` des vues.
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { DisputeCategorySchema, DisputeDesiredOutcomeSchema, PayoutStatusSchema } from "./booking.enums";

/* ══ Paramètres serveur (spec §3.6) ═══════════════════════════ */

export const DISPUTE_MIN_DESCRIPTION_LENGTH = 50;
export const DISPUTE_MAX_DESCRIPTION_LENGTH = 2000;
export const DISPUTE_PHOTOS_MAX = 5;

/* ══ Confirmation anticipée ═══════════════════════════════════ */

export const ConfirmDealResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: z.literal("COMPLETED"),
    completedAt: z.iso.datetime(),
    payoutStatus: PayoutStatusSchema.meta({
      description: "SENT if the transfer succeeded inline, FAILED if the provider refused (retried by the cron — A67)",
    }),
    payoutAmountCents: z.number().int().meta({ description: "= pricing.transportCents (carrier net, D50)" }),
    currencyCode: z.string(),
  })
  .meta({ id: "ConfirmDealResponse", description: "Early confirmation done — payout released (INV-3: final)" });
export type ConfirmDealResponse = z.infer<typeof ConfirmDealResponseSchema>;

/* ══ Litige ═══════════════════════════════════════════════════ */

export const DisputeDealRequestSchema = z
  .object({
    category: DisputeCategorySchema,
    description: z
      .string()
      .trim()
      .min(DISPUTE_MIN_DESCRIPTION_LENGTH, `Description must be at least ${DISPUTE_MIN_DESCRIPTION_LENGTH} characters`)
      .max(DISPUTE_MAX_DESCRIPTION_LENGTH),
    pledgeAccepted: z.literal(true).meta({ description: "Honour pledge — must be true (anti-abuse, spec §3.6)" }),
    photoUrls: z
      .array(z.url())
      .max(DISPUTE_PHOTOS_MAX, `At most ${DISPUTE_PHOTOS_MAX} photos`)
      .default([])
      .meta({ description: "ImageKit URLs (direct signed upload — D42), optional but recommended" }),
    desiredOutcome: DisputeDesiredOutcomeSchema.optional(),
  })
  .meta({ id: "DisputeDealRequest", description: "Open a dispute (shipper, DELIVERED, before payoutDueAt)" });
export type DisputeDealRequest = z.infer<typeof DisputeDealRequestSchema>;

export const DisputeDealResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: z.literal("DISPUTED"),
    ticketNumber: z.string().meta({ example: "YAM-2041" }),
    disputedAt: z.iso.datetime(),
  })
  .meta({ id: "DisputeDealResponse", description: "Dispute opened — payout frozen, ticket issued (INV-4/INV-5)" });
export type DisputeDealResponse = z.infer<typeof DisputeDealResponseSchema>;

/** Dossier de litige servi à l'Expéditeur seul (A68) dans `GET /deals/:id`. */
export const ShipperDisputeViewSchema = z
  .object({
    ticketNumber: z.string(),
    category: DisputeCategorySchema,
    description: z.string(),
    desiredOutcome: DisputeDesiredOutcomeSchema.nullable(),
    photoUrls: z.array(z.string()),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "ShipperDisputeView", description: "The dispute file as filed by the shipper (never served to the carrier)" });
export type ShipperDisputeView = z.infer<typeof ShipperDisputeViewSchema>;
