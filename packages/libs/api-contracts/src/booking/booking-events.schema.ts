import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { ParcelCategorySchema } from "../trip/trip.enums";
import {
  BookingActorSchema,
  BookingViewerRoleSchema,
  TrackingStepSchema,
  DisputeCategorySchema,
} from "./booking.enums";

/**
 * @packages/api-contracts — booking domain events (D2, PR3)
 * =========================================================
 * Contrat des 17 événements de la matrice notifications (A15) —
 * surface PUBLIQUE (event keys + payloads EN), porte à sens unique.
 *
 * Chaîne : transition → OutboxEvent (même transaction Mongo) →
 * relay (PR4) → Redpanda → consumers (notification-service 6004 en
 * PR4bis, puis analytics/recommendation en replay — verrou 3 : les
 * payloads sont RICHES pour que l'historique soit exploitable à
 * jamais : corridor, catégorie, montants, acteur, raisons).
 *
 * Versionnement : schemaVersion entier par événement. Toute évolution
 * incompatible = nouveau literal de version, jamais de mutation.
 */

/* ══ Types d'événements (source unique) ═══════════════════════ */

export const BOOKING_EVENT_TYPES = [
  "booking.requested",
  "booking.payment_authorized",
  "booking.accepted",
  "booking.declined",
  "booking.expired",
  "booking.cancelled",
  "booking.refund_issued",
  "booking.picked_up",
  "booking.pickup_refused",
  "booking.tracking_event",
  "booking.code_regenerated",
  "booking.delivered",
  "booking.completed",
  "booking.payout_sent",
  "booking.disputed",
  "booking.verification_reminder",
  "booking.rating_reminder",
  "booking.rating_revealed",
  "booking.dispute_carrier_responded",
  "booking.dispute_resolved",
] as const;

export const BookingEventTypeSchema = z
  .enum(BOOKING_EVENT_TYPES)
  .meta({ id: "BookingEventType", description: "All booking domain event keys (outbox → Kafka topics)" });
export type BookingEventType = z.infer<typeof BookingEventTypeSchema>;

/* ══ Socle commun des payloads (verrou 3 — richesse) ══════════ */

export const BookingEventCorridorSchema = z
  .object({
    originCity: z.string(),
    originCountryCode: z.string().nullish(),
    destinationCity: z.string(),
    destinationCountryCode: z.string().nullish(),
  })
  .meta({ id: "BookingEventCorridor", description: "Frozen corridor facts for per-destination analytics" });

export const BookingEventBasePayloadSchema = z
  .object({
    bookingId: ObjectIdSchema,
    tripId: ObjectIdSchema,
    shipperId: ObjectIdSchema,
    carrierId: ObjectIdSchema,
    corridor: BookingEventCorridorSchema,
    category: ParcelCategorySchema,
    categoryFamily: z.string().nullish(),
    weightKg: z.number(),
    transportCents: z.number().int().meta({ description: "Carrier net (integer cents, A2)" }),
    totalShipperCents: z.number().int(),
    currencyCode: z.string(),
    actor: BookingActorSchema.meta({ description: "Who triggered the event" }),
  })
  .meta({
    id: "BookingEventBasePayload",
    description: "Facts carried by EVERY booking event — rich by design so replayed history feeds future consumers",
  });

/* ══ Enveloppe commune ════════════════════════════════════════ */

const envelope = {
  aggregateType: z.literal("booking"),
  aggregateId: ObjectIdSchema,
  occurredAt: z.iso.datetime().meta({ description: "Server clock at transition time" }),
  correlationId: z.string().nullish().meta({ description: "Propagated request correlation ID (gateway-born)" }),
  schemaVersion: z.literal(1),
};

/* ══ Les 17 événements ════════════════════════════════════════ */

export const BookingRequestedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.requested"),
    payload: BookingEventBasePayloadSchema.extend({
      expiresAt: z.iso.datetime().meta({ description: "24h acceptance deadline — carrier notification carries it" }),
    }),
  })
  .meta({ id: "BookingRequestedEvent", description: "New deal request → notify carrier (push + email, deadline)" });

export const BookingPaymentAuthorizedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.payment_authorized"),
    payload: BookingEventBasePayloadSchema.extend({
      paymentIntentId: z.string().nullish().meta({ description: "Filled from B2 (Stripe escrow)" }),
      amountCents: z.number().int(),
    }),
  })
  .meta({ id: "BookingPaymentAuthorizedEvent", description: "Escrow authorized → shipper receipt email" });

export const BookingAcceptedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.accepted"),
    payload: BookingEventBasePayloadSchema.extend({
      acceptedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingAcceptedEvent", description: "Carrier accepted (charter signed) → notify shipper" });

export const BookingDeclinedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.declined"),
    payload: BookingEventBasePayloadSchema.extend({
      reason: z.string().nullish().meta({ description: "One of 5 optional decline reasons — refusal analytics" }),
      closedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingDeclinedEvent", description: "Carrier declined → full refund + notify shipper" });

export const BookingExpiredEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.expired"),
    payload: BookingEventBasePayloadSchema.extend({
      closedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingExpiredEvent", description: "24h elapsed without answer (cron) → full refund + notify shipper" });

export const BookingCancelledEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.cancelled"),
    payload: BookingEventBasePayloadSchema.extend({
      cancelledBy: BookingActorSchema,
      reason: z.string().nullish().meta({ description: "Persisted from B2 (cancelReason field)" }),
      wasAccepted: z.boolean().meta({ description: "true = post-acceptance cancellation → carrier is notified too" }),
      closedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingCancelledEvent", description: "Cancellation → refund per policy (ANN-01) + notifications" });

export const BookingRefundIssuedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.refund_issued"),
    payload: BookingEventBasePayloadSchema.extend({
      amountCents: z.number().int(),
      refundedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingRefundIssuedEvent", description: "Stripe refund succeeded (B2) → shipper confirmation email" });

export const BookingPickedUpEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.picked_up"),
    payload: BookingEventBasePayloadSchema.extend({
      pickedUpAt: z.iso.datetime(),
      photoCount: z.number().int(),
    }),
  })
  .meta({
    id: "BookingPickedUpEvent",
    description:
      "Pickup confirmed, delivery code generated → notify shipper with an in-app CTA. The code itself NEVER travels in events or emails.",
  });

export const BookingPickupRefusedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.pickup_refused"),
    payload: BookingEventBasePayloadSchema.extend({
      reason: z.string().nullish().meta({ description: "Persisted from B2 (pickupRefusalReason field)" }),
      closedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingPickupRefusedEvent", description: "Refused at pickup → cancellation + refund + notify shipper" });

export const BookingTrackingEventEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.tracking_event"),
    payload: BookingEventBasePayloadSchema.extend({
      step: TrackingStepSchema,
      confirmedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingTrackingEventEvent", description: "Optional milestone → shipper push only (no email, anti-spam)" });

export const BookingCodeRegeneratedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.code_regenerated"),
    payload: BookingEventBasePayloadSchema.extend({
      regenerationsUsed: z.number().int(),
      regenerationsLeft: z.number().int(),
    }),
  })
  .meta({ id: "BookingCodeRegeneratedEvent", description: "Code regenerated → shipper security email (code not included)" });

export const BookingDeliveredEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.delivered"),
    payload: BookingEventBasePayloadSchema.extend({
      deliveredAt: z.iso.datetime(),
      payoutDueAt: z.iso.datetime().meta({ description: "D+4 — end of the shipper verification window" }),
      attemptsUsed: z.number().int(),
    }),
  })
  .meta({
    id: "BookingDeliveredEvent",
    description: "Valid code entered → shipper '3 days to confirm or report' + carrier payout-scheduled notice",
  });

export const BookingCompletedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.completed"),
    payload: BookingEventBasePayloadSchema.extend({
      completedAt: z.iso.datetime(),
      completedBy: BookingActorSchema.meta({ description: "SHIPPER = early confirmation, SYSTEM = D+4 auto" }),
    }),
  })
  .meta({ id: "BookingCompletedEvent", description: "Deal completed → payout release + mutual rating invitations" });

export const BookingPayoutSentEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.payout_sent"),
    payload: BookingEventBasePayloadSchema.extend({
      transferId: z.string().nullish().meta({ description: "Stripe transfer id (B4)" }),
      amountCents: z.number().int().meta({ description: "Carrier net (DELIVERY) or ANN-01 compensation (LATE_CANCELLATION)" }),
      reason: z.enum(["DELIVERY", "LATE_CANCELLATION"]).nullish().meta({
        description: "Why the carrier is paid (A82). Absent on pre-D50 events = DELIVERY.",
      }),
    }),
  })
  .meta({ id: "BookingPayoutSentEvent", description: "Stripe transfer executed → notify carrier" });

export const BookingDisputedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.disputed"),
    payload: BookingEventBasePayloadSchema.extend({
      ticketNumber: z.string().meta({ example: "YAM-2041" }),
      disputedAt: z.iso.datetime(),
      disputeCategory: DisputeCategorySchema.nullish().meta({
        description: "Why the shipper disputed — the carrier learns the category, never the file (A68). Absent on pre-B4 events.",
      }),
    }),
  })
  .meta({
    id: "BookingDisputedEvent",
    description: "Dispute filed → payout frozen, shipper acknowledgment (≤48 business hours) + carrier statement request",
  });

export const BookingVerificationReminderEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.verification_reminder"),
    payload: BookingEventBasePayloadSchema.extend({
      payoutDueAt: z.iso.datetime().meta({ description: "End of the verification window (D+4) — the reminder fires at D+3" }),
    }),
  })
  .meta({ id: "BookingVerificationReminderEvent", description: "D+3 reminder to the shipper: last day to confirm or dispute (B4/A70)" });

export const BookingRatingReminderEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.rating_reminder"),
    payload: BookingEventBasePayloadSchema.extend({
      reminderNumber: z.union([z.literal(1), z.literal(2)]).meta({ description: "D+5 then D+7, then stop (no spam)" }),
      targetRole: BookingViewerRoleSchema.meta({ description: "The party who has not rated yet" }),
    }),
  })
  .meta({ id: "BookingRatingReminderEvent", description: "Rating reminder crons (D+5 / D+7)" });

export const BookingRatingRevealedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.rating_revealed"),
    payload: BookingEventBasePayloadSchema.extend({
      revealedReason: z.enum(["BOTH_RATED", "WINDOW_ELAPSED"]).meta({ description: "Double-blind lift: both rated, or 14 days" }),
    }),
  })
  .meta({ id: "BookingRatingRevealedEvent", description: "Double-blind reviews revealed → in-app notification to both" });

export const BookingDisputeCarrierRespondedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.dispute_carrier_responded"),
    payload: BookingEventBasePayloadSchema.extend({
      ticketNumber: z.string(),
      respondedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingDisputeCarrierRespondedEvent", description: "The carrier gave their side in the app (C-PR2, D55) — no notification, the admin queue shows it" });

export const BookingDisputeResolvedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("booking.dispute_resolved"),
    payload: BookingEventBasePayloadSchema.extend({
      kind: z.enum(["DISPUTE", "RETENTION"]),
      ticketNumber: z.string().nullable(),
      outcome: z.enum(["REJECTED", "PARTIAL_REFUND", "FULL_REFUND", "COMPENSATE_CARRIER", "RESTITUTE_SHIPPER"]),
      refundCents: z.number().int(),
      carrierPayoutCents: z.number().int(),
      reason: z.string(),
      finalStatus: z.enum(["COMPLETED", "CANCELLED"]),
      resolvedAt: z.iso.datetime(),
    }),
  })
  .meta({ id: "BookingDisputeResolvedEvent", description: "Admin decision (C-PR2, D55) → both parties notified with the outcome, their amount and the reason" });

/* ══ Union discriminée (consommateurs) ════════════════════════ */

export const BookingDomainEventSchema = z
  .discriminatedUnion("eventType", [
    BookingRequestedEventSchema,
    BookingPaymentAuthorizedEventSchema,
    BookingAcceptedEventSchema,
    BookingDeclinedEventSchema,
    BookingExpiredEventSchema,
    BookingCancelledEventSchema,
    BookingRefundIssuedEventSchema,
    BookingPickedUpEventSchema,
    BookingPickupRefusedEventSchema,
    BookingTrackingEventEventSchema,
    BookingCodeRegeneratedEventSchema,
    BookingDeliveredEventSchema,
    BookingCompletedEventSchema,
    BookingPayoutSentEventSchema,
    BookingDisputedEventSchema,
    BookingVerificationReminderEventSchema,
    BookingRatingReminderEventSchema,
    BookingRatingRevealedEventSchema,
    BookingDisputeCarrierRespondedEventSchema,
    BookingDisputeResolvedEventSchema,
  ])
  .meta({
    id: "BookingDomainEvent",
    description: "Any booking domain event — the parsing contract for every consumer (notifications, analytics, replay)",
  });
export type BookingDomainEvent = z.infer<typeof BookingDomainEventSchema>;
