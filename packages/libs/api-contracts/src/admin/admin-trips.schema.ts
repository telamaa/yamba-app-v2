/**
 * admin-trips.schema.ts — trajets, billets, KPI d'accueil (C-PR4, D57)
 * =====================================================================
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const TicketRejectionReasonSchema = z.enum(["ILLEGIBLE", "DATES_MISMATCH", "NAME_MISMATCH", "SUSPICIOUS"]).meta({ id: "TicketRejectionReason" });
export type TicketRejectionReason = z.infer<typeof TicketRejectionReasonSchema>;

export const HIDE_MIN_REASON_LENGTH = 20;

export const AdminTripSummarySchema = z
  .object({
    id: ObjectIdSchema,
    status: z.string(),
    originCity: z.string(),
    destinationCity: z.string(),
    departureAt: z.string().datetime().nullable(),
    transportMode: z.string().nullable(),
    carrier: z.object({ id: ObjectIdSchema, firstName: z.string(), lastName: z.string(), accountStatus: z.string() }),
    ticketVerificationStatus: z.string(),
    hidden: z.boolean(),
    hideProposed: z.boolean(),
    activeBookingsCount: z.number().int(),
    publishedAt: z.string().datetime().nullable(),
  })
  .meta({ id: "AdminTripSummary" });
export type AdminTripSummary = z.infer<typeof AdminTripSummarySchema>;
export const AdminTripsResponseSchema = z
  .object({ items: z.array(AdminTripSummarySchema), total: z.number().int(), nextCursor: z.string().nullable().optional().meta({ description: "C-PR7a — id du dernier élément ; absent = fin" }) })
  .meta({ id: "AdminTripsResponse" });

/* ── C-PR7a (D60 2A) — filtres serveur ── */
export const AdminTripsQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(20).optional(),
    hidden: z.enum(["1", "0"]).optional(),
    ticketPending: z.enum(["1", "0"]).optional(),
    hideProposed: z.enum(["1", "0"]).optional(),
    carrierId: ObjectIdSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    originCity: z.string().trim().max(80).optional(),
    destinationCity: z.string().trim().max(80).optional(),
    sort: z.enum(["departureAt", "publishedAt", "createdAt"]).default("departureAt"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    cursor: ObjectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .meta({ id: "AdminTripsQuery" });
export type AdminTripsQuery = z.infer<typeof AdminTripsQuerySchema>;
export const TicketQueueQuerySchema = z
  .object({
    originCity: z.string().trim().max(80).optional(),
    destinationCity: z.string().trim().max(80).optional(),
    submittedFrom: z.string().datetime().optional(),
    submittedTo: z.string().datetime().optional(),
    olderThanDays: z.coerce.number().int().min(0).max(365).optional(),
  })
  .meta({ id: "TicketQueueQuery" });
export type TicketQueueQuery = z.infer<typeof TicketQueueQuerySchema>;
export type AdminTripsResponse = z.infer<typeof AdminTripsResponseSchema>;

export const AdminTripFileSchema = z
  .object({
    id: ObjectIdSchema,
    status: z.string(),
    originCity: z.string(),
    destinationCity: z.string(),
    departureAt: z.string().datetime().nullable(),
    arrivalAt: z.string().datetime().nullable(),
    transportMode: z.string().nullable(),
    capacityKg: z.number().nullable(),
    reservedKg: z.number().nullable(),
    pricing: z.unknown().nullable(),
    createdAt: z.string().datetime(),
    publishedAt: z.string().datetime().nullable(),
    cancelledAt: z.string().datetime().nullable(),
    carrier: z.object({ id: ObjectIdSchema, firstName: z.string(), lastName: z.string(), email: z.string(), accountStatus: z.string(), carrierStatus: z.string() }),
    ticketVerificationStatus: z.string(),
    hidden: z.object({ at: z.string().datetime(), reason: z.string(), byAdmin: z.string() }).nullable(),
    hideProposal: z.object({ reason: z.string(), byAdmin: z.string(), at: z.string().datetime() }).nullable(),
    documents: z.array(
      z.object({
        id: ObjectIdSchema,
        type: z.string(),
        status: z.string(),
        originalName: z.string().nullable(),
        createdAt: z.string().datetime(),
        reviewedAt: z.string().datetime().nullable(),
        rejectionReason: z.string().nullable(),
      })
    ),
    bookings: z.array(
      z.object({
        id: ObjectIdSchema,
        status: z.string(),
        shipperFirstName: z.string(),
        weightKg: z.number(),
        totalShipperCents: z.number().int(),
        transportCents: z.number().int(),
        currencyCode: z.string(),
        disputeTicket: z.string().nullable(),
        requestedAt: z.string().datetime(),
      })
    ),
    adminActions: z.array(z.object({ id: ObjectIdSchema, at: z.string().datetime(), admin: z.string(), action: z.string(), after: z.unknown().nullable() })),
  })
  .meta({ id: "AdminTripFile" });
export type AdminTripFile = z.infer<typeof AdminTripFileSchema>;

export const TicketQueueItemSchema = z
  .object({
    documentId: ObjectIdSchema,
    tripId: ObjectIdSchema,
    originCity: z.string(),
    destinationCity: z.string(),
    departureAt: z.string().datetime().nullable(),
    transportMode: z.string().nullable(),
    carrier: z.object({ id: ObjectIdSchema, firstName: z.string(), lastName: z.string() }),
    originalName: z.string().nullable(),
    mimeType: z.string().nullable(),
    submittedAt: z.string().datetime(),
  })
  .meta({ id: "TicketQueueItem" });
export type TicketQueueItem = z.infer<typeof TicketQueueItemSchema>;
export const TicketQueueResponseSchema = z.object({ items: z.array(TicketQueueItemSchema), expiredNow: z.number().int() }).meta({ id: "TicketQueueResponse" });
export type TicketQueueResponse = z.infer<typeof TicketQueueResponseSchema>;

export const ReviewTicketRequestSchema = z
  .object({
    decision: z.enum(["VERIFY", "REJECT"]),
    reason: TicketRejectionReasonSchema.optional().meta({ description: "Required when REJECT" }),
  })
  .refine((v) => v.decision === "VERIFY" || !!v.reason, { message: "A rejection needs a reason", path: ["reason"] })
  .meta({ id: "ReviewTicketRequest" });
export type ReviewTicketRequest = z.infer<typeof ReviewTicketRequestSchema>;

export const HideTripRequestSchema = z.object({ reason: z.string().trim().min(HIDE_MIN_REASON_LENGTH).max(2000) }).meta({ id: "HideTripRequest" });
export type HideTripRequest = z.infer<typeof HideTripRequestSchema>;

export const AdminHomeKpisSchema = z
  .object({
    disputesToDecide: z.number().int().nullable(),
    retentionsHeld: z.number().int().nullable(),
    ticketsToVerify: z.number().int().nullable(),
    hiddenTrips: z.number().int().nullable(),
    hideProposals: z.number().int().nullable(),
    suspensionProposals: z.number().int().nullable(),
    restrictedUsers: z.number().int().nullable(),
    suspendedUsers: z.number().int().nullable(),
    publishedTrips: z.number().int().nullable(),
    activeDeals: z.number().int().nullable(),
    payoutsFailed: z.number().int().nullable(),
    payoutsReversed: z.number().int().nullable(), // C-PR5 (D58)
    manualRefundProposals: z.number().int().nullable(), // C-PR5b (D58)
    pendingAdminInvites: z.number().int().nullable(),
    usersTotal: z.number().int().nullable(),
    completedDeals30d: z.number().int().nullable(),
    generatedAt: z.string().datetime(),
  })
  .meta({ id: "AdminHomeKpis", description: "Operational counters; null = not visible to this profile (D57)" });
export type AdminHomeKpis = z.infer<typeof AdminHomeKpisSchema>;
