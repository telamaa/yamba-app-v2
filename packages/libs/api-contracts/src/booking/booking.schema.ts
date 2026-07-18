import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { ParcelCategorySchema } from "../trip/trip.enums";
import {
  BookingStatusSchema,
  BookingActorSchema,
  BookingViewerRoleSchema,
  BookingTransitionActionSchema,
  PricingModelSchema,
  TrackingStepSchema,
} from "./booking.enums";

/**
 * @packages/api-contracts — booking schemas (surface deal, PR3)
 * =============================================================
 * Snapshots (miroirs des composites Prisma) + DTOs PAR RÔLE.
 *
 * Règle de sécurité cardinale (spec §9, A13) : les vues sont des
 * LISTES BLANCHES construites champ par champ — jamais de spread
 * du document Prisma. `deliveryCodeHash` n'apparaît dans AUCUNE vue ;
 * le code n'apparaît que côté Shipper.
 *
 * `allowedActions` = getAllowedActions(booking, role) — le front
 * reflète, ne décide jamais (même contrat moral que TripWithActions).
 */

/* ══ Snapshots (miroirs Prisma, figés à la création) ══════════ */

export const BookingTripSnapshotSchema = z
  .object({
    originCity: z.string(),
    originCountryCode: z.string().nullish().meta({ example: "FR" }),
    originTimezone: z.string().nullish().meta({ example: "Europe/Paris" }),
    destinationCity: z.string(),
    destinationCountryCode: z.string().nullish().meta({ example: "CG" }),
    destinationTimezone: z.string().nullish().meta({ example: "Africa/Brazzaville" }),
    departureAt: z.iso.datetime().meta({ description: "UTC — local rendering uses the two IANA timezones (D24)" }),
    transportMode: z.string().nullish(),
  })
  .meta({
    id: "BookingTripSnapshot",
    description: "Trip facts frozen at booking creation — the deal stays readable even if the trip changes",
  });

export const BookingParcelSnapshotSchema = z
  .object({
    category: ParcelCategorySchema,
    categoryFamily: z.string().nullish().meta({ description: "D14 risk-family mapping, frozen at creation" }),
    description: z.string(),
    declaredValueCents: z.number().int().nonnegative(),
    photoUrls: z.array(z.string()).meta({ description: "Shipper declaration photos (R2, timestamped)" }),
  })
  .meta({ id: "BookingParcelSnapshot" });

export const BookingRecipientSnapshotSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    phoneE164: z.string().meta({ example: "+242061234567" }),
    email: z.string(),
  })
  .meta({
    id: "BookingRecipientSnapshot",
    description: "Recipient contact — visible to both roles (the carrier needs it to deliver)",
  });

export const BookingPickupInfoSchema = z
  .object({
    confirmedAt: z.iso.datetime(),
    photoUrls: z.array(z.string()).meta({ description: "Carrier pickup photos (R2, timestamped)" }),
    notes: z.string().nullish(),
  })
  .meta({ id: "BookingPickupInfo" });

export const BookingTrackingEventSchema = z
  .object({
    step: TrackingStepSchema,
    confirmedAt: z.iso.datetime(),
  })
  .meta({ id: "BookingTrackingEvent" });

/* ══ Pricing — vue Shipper (complète) vs vue Carrier (gains) ══ */

export const ShipperPricingSchema = z
  .object({
    pricingModel: PricingModelSchema,
    weightKg: z.number(),
    categoryPriceCents: z.number().int().nullish().meta({ description: "PER_CATEGORY engine" }),
    pricePerKgCents: z.number().int().nullish().meta({ description: "PER_KG engine (D13)" }),
    sizeClass: z.string().nullish().meta({ example: "M" }),
    transportCents: z.number().int().meta({ description: "Carrier net (COM-03)" }),
    commissionPct: z.number().meta({ description: "Frozen at creation (COM-04)" }),
    commissionCents: z.number().int().meta({ description: "Floor already applied (D16)" }),
    protectionProvider: z.string().nullish(),
    protectionTier: z.string().nullish(),
    premiumCents: z.number().int().meta({ description: "Protection premium, separate flow (D22)" }),
    totalShipperCents: z.number().int().meta({ description: "Total charged to the shipper" }),
    currencyCode: z.string().meta({ example: "EUR" }),
  })
  .meta({
    id: "ShipperPricing",
    description: "Full pricing snapshot — shipper view only (all amounts in integer cents, A2)",
  });

export const CarrierPricingSchema = z
  .object({
    pricingModel: PricingModelSchema,
    weightKg: z.number(),
    categoryPriceCents: z.number().int().nullish(),
    pricePerKgCents: z.number().int().nullish(),
    sizeClass: z.string().nullish(),
    transportCents: z.number().int().meta({ description: "Carrier net earnings for this deal (COM-03)" }),
    currencyCode: z.string().meta({ example: "EUR" }),
  })
  .meta({
    id: "CarrierPricing",
    description:
      "Earnings-only pricing view — commission and shipper total are never exposed to the carrier",
  });

/* ══ Contrepartie (jointure explicite, privacy PublicTripper) ═ */

export const BookingCounterpartSchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string().nullish(),
    lastInitial: z.string().meta({ description: "Last-name initial, '' if absent (privacy)" }),
    avatarUrl: z.string().nullable(),
  })
  .meta({
    id: "BookingCounterpart",
    description: "Minimal profile of the other party (explicit join — Booking has no Prisma relations)",
  });

/* ══ Jalons partagés par les deux vues ════════════════════════ */

const milestoneFields = {
  requestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().meta({ description: "requestedAt + 24h acceptance deadline" }),
  acceptedAt: z.iso.datetime().nullish(),
  pickedUpAt: z.iso.datetime().nullish(),
  deliveredAt: z.iso.datetime().nullish(),
  payoutDueAt: z.iso.datetime().nullish().meta({ description: "deliveredAt + D+4 (verification window end)" }),
  completedAt: z.iso.datetime().nullish(),
  closedAt: z.iso.datetime().nullish().meta({ description: "Set on DECLINED / EXPIRED / CANCELLED" }),
  closedBy: BookingActorSchema.nullish(),
  declineReason: z.string().nullish(),
  disputeTicket: z.string().nullish().meta({ example: "YAM-2041" }),
  disputedAt: z.iso.datetime().nullish(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/* ══ Vues par rôle (listes blanches — A13) ════════════════════ */

export const ShipperBookingViewSchema = z
  .object({
    id: ObjectIdSchema,
    tripId: ObjectIdSchema,
    carrierId: ObjectIdSchema,
    status: BookingStatusSchema,

    trip: BookingTripSnapshotSchema,
    pricing: ShipperPricingSchema,
    parcel: BookingParcelSnapshotSchema,
    recipient: BookingRecipientSnapshotSchema,
    carrier: BookingCounterpartSchema,

    ...milestoneFields,

    deliveryCode: z.string().nullable().meta({
      description:
        "6-digit delivery code — null until encrypted-at-rest storage lands (B2, deliveryCodeEncrypted). Never present in any carrier payload.",
    }),
    codeRegenerationsLeft: z.number().int().meta({
      description: "MAX_CODE_REGENERATIONS (5) minus regenerations used — server is the only judge",
    }),

    pickup: BookingPickupInfoSchema.nullish(),
    trackingEvents: z.array(BookingTrackingEventSchema),

    allowedActions: z.array(BookingTransitionActionSchema).meta({
      description: "getAllowedActions(booking, 'SHIPPER') — drives the frontend CTAs",
    }),
  })
  .meta({
    id: "ShipperBookingView",
    description: "Deal as seen by the shipper ('Mes envois')",
  });
export type ShipperBookingView = z.infer<typeof ShipperBookingViewSchema>;

export const CarrierBookingViewSchema = z
  .object({
    id: ObjectIdSchema,
    tripId: ObjectIdSchema,
    shipperId: ObjectIdSchema,
    status: BookingStatusSchema,

    trip: BookingTripSnapshotSchema,
    pricing: CarrierPricingSchema,
    parcel: BookingParcelSnapshotSchema,
    recipient: BookingRecipientSnapshotSchema,
    shipper: BookingCounterpartSchema,

    ...milestoneFields,

    deliveryAttemptsLeft: z.number().int().meta({
      description: "MAX_DELIVERY_ATTEMPTS (3) minus attempts used — the code itself is NEVER exposed here",
    }),
    deliveryLockedUntil: z.iso.datetime().nullish().meta({
      description: "Anti brute-force lock (15 min after 3 failed attempts, server-side)",
    }),

    pickup: BookingPickupInfoSchema.nullish(),
    trackingEvents: z.array(BookingTrackingEventSchema),

    allowedActions: z.array(BookingTransitionActionSchema).meta({
      description: "getAllowedActions(booking, 'CARRIER') — drives the frontend CTAs",
    }),
  })
  .meta({
    id: "CarrierBookingView",
    description:
      "Deal as seen by the carrier — no delivery code, no code hash, no regeneration counter, no shipper total",
  });
export type CarrierBookingView = z.infer<typeof CarrierBookingViewSchema>;

/* ══ Requêtes ═════════════════════════════════════════════════ */

export const MyBookingsQuerySchema = z
  .object({
    status: BookingStatusSchema.optional().meta({ description: "Filter by status (exact match)" }),
  })
  .meta({ id: "MyBookingsQuery" });

export const TripDealsQuerySchema = z
  .object({
    tripId: ObjectIdSchema.meta({ description: "Trip whose deals are requested — must belong to the caller" }),
    status: BookingStatusSchema.optional(),
  })
  .meta({ id: "TripDealsQuery" });

/* ══ Réponses ═════════════════════════════════════════════════ */

/** GET /deals/:id — 200. La forme du deal dépend du rôle du lecteur. */
export const DealResponseSchema = z
  .object({
    success: z.literal(true),
    viewerRole: BookingViewerRoleSchema,
    deal: z.union([ShipperBookingViewSchema, CarrierBookingViewSchema]).meta({
      description: "ShipperBookingView when viewerRole=SHIPPER, CarrierBookingView when viewerRole=CARRIER",
    }),
  })
  .meta({ id: "DealResponse" });

/** GET /me/bookings — 200 (vue Shipper, 'Mes envois'). */
export const MyBookingsResponseSchema = z
  .object({
    success: z.literal(true),
    bookings: z.array(ShipperBookingViewSchema),
    count: z.number().int(),
  })
  .meta({ id: "MyBookingsResponse" });

/** GET /deals?tripId= — 200 (vue Carrier, deals d'un de ses trips). */
export const TripDealsResponseSchema = z
  .object({
    success: z.literal(true),
    deals: z.array(CarrierBookingViewSchema),
    count: z.number().int(),
  })
  .meta({ id: "TripDealsResponse" });
