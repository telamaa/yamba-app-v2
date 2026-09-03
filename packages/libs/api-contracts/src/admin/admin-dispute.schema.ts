/**
 * admin-dispute.schema.ts — file « à arbitrer » et dossier de médiation (chantier C, D54)
 * =======================================================================================
 * Vue ADMIN d'un deal en attente d'arbitrage : litige OPEN (DISPUTED) ou retenue
 * « à arbitrer » (CANCELLED après le départ sans prise en charge, A81).
 * Whitelist stricte : le dossier sert les preuves des deux côtés (photos de
 * déclaration, de prise en charge, de remise, de litige), jamais le code de
 * livraison (ni hash, ni chiffré — D43), jamais les identifiants de paiement bruts.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { DisputeCategorySchema, DisputeDesiredOutcomeSchema } from "../booking/booking.enums";

export const ArbitrationKindSchema = z.enum(["DISPUTE", "RETENTION"]).meta({ id: "ArbitrationKind" });
export type ArbitrationKind = z.infer<typeof ArbitrationKindSchema>;

const PartySchema = z.object({
  id: ObjectIdSchema,
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  completedDealsCount: z.number().int(),
  lateCancellationsCount: z.number().int(),
  ratingsAvg: z.number(),
  ratingsCount: z.number().int(),
});

export const ArbitrationQueueItemSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: ArbitrationKindSchema,
    ticketNumber: z.string().nullable(),
    category: DisputeCategorySchema.nullable(),
    openedAt: z.string().datetime(),
    originCity: z.string(),
    destinationCity: z.string(),
    amountCents: z.number().int().meta({ description: "Total paid by the shipper (DISPUTE) or retained amount (RETENTION)" }),
    currencyCode: z.string(),
    shipperFirstName: z.string(),
    carrierFirstName: z.string(),
  })
  .meta({ id: "ArbitrationQueueItem" });
export type ArbitrationQueueItem = z.infer<typeof ArbitrationQueueItemSchema>;

export const ArbitrationQueueResponseSchema = z
  .object({ items: z.array(ArbitrationQueueItemSchema), counts: z.object({ disputes: z.number().int(), retentions: z.number().int() }) })
  .meta({ id: "ArbitrationQueueResponse" });
export type ArbitrationQueueResponse = z.infer<typeof ArbitrationQueueResponseSchema>;

export const AdminDisputeFileSchema = z
  .object({
    bookingId: ObjectIdSchema,
    kind: ArbitrationKindSchema,
    status: z.string(),
    timeline: z.object({
      requestedAt: z.string().datetime(),
      acceptedAt: z.string().datetime().nullable(),
      departureAt: z.string().datetime(),
      pickedUpAt: z.string().datetime().nullable(),
      deliveredAt: z.string().datetime().nullable(),
      disputedAt: z.string().datetime().nullable(),
      closedAt: z.string().datetime().nullable(),
      closedBy: z.string().nullable(),
      cancelReason: z.string().nullable(),
    }),
    corridor: z.object({ originCity: z.string(), destinationCity: z.string(), transportMode: z.string().nullable() }),
    parcel: z.object({
      category: z.string(),
      description: z.string(),
      declaredValueCents: z.number().int(),
      weightKg: z.number(),
      photoUrls: z.array(z.string()),
    }),
    recipient: z.object({ firstName: z.string(), lastName: z.string() }),
    money: z.object({
      totalShipperCents: z.number().int(),
      transportCents: z.number().int().meta({ description: "Carrier net" }),
      commissionCents: z.number().int(),
      premiumCents: z.number().int(),
      currencyCode: z.string(),
      capturedAt: z.string().datetime().nullable(),
      refundedAt: z.string().datetime().nullable(),
      refundAmountCents: z.number().int().nullable(),
      payoutStatus: z.string().nullable(),
      payoutAmountCents: z.number().int().nullable(),
      retentionCents: z.number().int().nullable(),
      retentionDisposition: z.string().nullable(),
    }),
    shipper: PartySchema,
    carrier: PartySchema,
    pickup: z
      .object({ confirmedAt: z.string().datetime(), photoUrls: z.array(z.string()), checklist: z.array(z.string()), notes: z.string().nullable() })
      .nullable(),
    trackingEvents: z.array(z.object({ step: z.string(), confirmedAt: z.string().datetime() })),
    deliveryPhotoUrls: z.array(z.string()),
    dispute: z
      .object({
        ticketNumber: z.string(),
        category: DisputeCategorySchema,
        description: z.string(),
        desiredOutcome: DisputeDesiredOutcomeSchema.nullable(),
        photoUrls: z.array(z.string()),
        pledgeAcceptedAt: z.string().datetime(),
        status: z.string(),
      })
      .nullable(),
  })
  .meta({ id: "AdminDisputeFile", description: "Full mediation file for an admin — never the delivery code (D43)" });
export type AdminDisputeFile = z.infer<typeof AdminDisputeFileSchema>;
