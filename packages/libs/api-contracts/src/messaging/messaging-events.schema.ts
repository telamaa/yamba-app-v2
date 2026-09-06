/**
 * messaging-events.schema.ts — événements de conversation (chantier F, D61)
 * =========================================================================
 * Même discipline que les événements booking (D2) : enveloppe commune, union discriminée,
 * validés par le relais AVANT publication. Topic dédié `messaging-events` : le relais du
 * deal-service ne lit que `aggregateType: "booking"`, celui du message-service que "conversation".
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const MESSAGING_EVENT_TYPES = ["conversation.message_posted", "conversation.meetup_proposed", "conversation.meetup_accepted", "conversation.phone_revealed"] as const;
export const MessagingEventTypeSchema = z.enum(MESSAGING_EVENT_TYPES).meta({ id: "MessagingEventType" });
export type MessagingEventType = (typeof MESSAGING_EVENT_TYPES)[number];

const envelope = {
  aggregateType: z.literal("conversation"),
  aggregateId: ObjectIdSchema,
  occurredAt: z.iso.datetime(),
  correlationId: z.string().nullable(),
  schemaVersion: z.literal(1),
};

const basePayload = z.object({
  conversationId: ObjectIdSchema,
  bookingId: ObjectIdSchema,
  shipperId: ObjectIdSchema,
  carrierId: ObjectIdSchema,
  actorRole: z.enum(["SHIPPER", "CARRIER", "SYSTEM"]),
  actorId: ObjectIdSchema.nullable(),
  /** Le destinataire de la notification : l'AUTRE partie */
  recipientId: ObjectIdSchema,
  corridor: z.object({ originCity: z.string(), destinationCity: z.string() }),
});

export const MessagePostedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("conversation.message_posted"),
    payload: basePayload.extend({ messageId: ObjectIdSchema, preview: z.string().max(140).describe("Extrait, jamais la totalité — l'email n'est pas le fil") }),
  })
  .meta({ id: "MessagePostedEvent" });

export const MeetupProposedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("conversation.meetup_proposed"),
    payload: basePayload.extend({ meetupId: ObjectIdSchema, kind: z.enum(["PICKUP", "DELIVERY"]), placeLabel: z.string(), startAt: z.iso.datetime() }),
  })
  .meta({ id: "MeetupProposedEvent" });

export const MeetupAcceptedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("conversation.meetup_accepted"),
    payload: basePayload.extend({ meetupId: ObjectIdSchema, kind: z.enum(["PICKUP", "DELIVERY"]), placeLabel: z.string(), startAt: z.iso.datetime() }),
  })
  .meta({ id: "MeetupAcceptedEvent" });

export const PhoneRevealedEventSchema = z
  .object({
    ...envelope,
    eventType: z.literal("conversation.phone_revealed"),
    payload: basePayload.extend({ revealedUserId: ObjectIdSchema }),
  })
  .meta({ id: "PhoneRevealedEvent" });

export const MessagingDomainEventSchema = z
  .discriminatedUnion("eventType", [MessagePostedEventSchema, MeetupProposedEventSchema, MeetupAcceptedEventSchema, PhoneRevealedEventSchema])
  .meta({ id: "MessagingDomainEvent" });
export type MessagingDomainEvent = z.infer<typeof MessagingDomainEventSchema>;
