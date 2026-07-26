/**
 * booking-events.consumer.ts — le PREMIER consumer de D2 (A25/A27)
 * =================================================================
 * Chaîne : relay (deal-service) → Redpanda `booking-events` → CE
 * handler → rows Notification (in-app) — matrice A15, 17 événements.
 *
 * Idempotence claim-first (modèle ConsumedEvent, schéma PR4bis) :
 *   1. create PENDING — P2002 : PROCESSED = doublon (skip),
 *      PENDING/FAILED = retraitement autorisé (crash antérieur) ;
 *   2. parse au CONTRAT RÉEL — échec = DÉFINITIF : FAILED +
 *      lastError, on ne bloque JAMAIS la partition pour un message
 *      malformé (l'outbox Mongo permet le rejeu manuel) ;
 *   3. matérialisation par UPSERT [eventId, userId] — rejouable
 *      sans doublon, un événement → N notifications ;
 *   4. update PROCESSED.
 * Toute erreur TRANSITOIRE (Mongo down) JETTE : l'offset n'est pas
 * commité, le broker re-livre — at-least-once assumé.
 */
import { z } from "zod";
import type { Logger } from "pino";
import { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import {
  CONSUMER_GROUPS,
  type ConsumedEventMessage,
} from "@packages/messaging";

type BookingDomainEvent = z.infer<typeof BookingDomainEventSchema>;
type BookingEventKey = BookingDomainEvent["eventType"];

export const GROUP = CONSUMER_GROUPS.NOTIFICATION_SERVICE;

/** Destinataire(s) in-app d'un événement — colonne in-app de la
 *  matrice A15, en DATA (comme la state machine) : un 18e événement
 *  = une ligne ici, jamais du code. */
type RecipientRule = "SHIPPER" | "CARRIER" | "BOTH" | "NONE" | "TARGET_ROLE";

export const IN_APP_MATRIX: Record<BookingEventKey, RecipientRule> = {
  "booking.requested": "CARRIER",
  "booking.payment_authorized": "NONE",
  "booking.accepted": "SHIPPER",
  "booking.declined": "SHIPPER",
  "booking.expired": "SHIPPER",
  "booking.cancelled": "BOTH",
  "booking.refund_issued": "NONE",
  "booking.picked_up": "SHIPPER",
  "booking.pickup_refused": "SHIPPER",
  "booking.tracking_event": "SHIPPER",
  "booking.code_regenerated": "NONE",
  "booking.delivered": "BOTH",
  "booking.completed": "BOTH",
  "booking.payout_sent": "CARRIER",
  "booking.disputed": "BOTH",
  "booking.rating_reminder": "TARGET_ROLE",
  "booking.rating_revealed": "BOTH",
};

export function resolveRecipients(event: BookingDomainEvent): string[] {
  switch (IN_APP_MATRIX[event.eventType]) {
    case "SHIPPER":
      return [event.payload.shipperId];
    case "CARRIER":
      return [event.payload.carrierId];
    case "BOTH":
      return [event.payload.shipperId, event.payload.carrierId];
    case "NONE":
      return [];
    case "TARGET_ROLE":
      // Seul booking.rating_reminder porte cette règle (targetRole).
      return event.eventType === "booking.rating_reminder" &&
      event.payload.targetRole === "CARRIER"
        ? [event.payload.carrierId]
        : [event.payload.shipperId];
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function markFailed(
  eventId: string,
  err: unknown,
  logger: Logger
): Promise<void> {
  await prisma.consumedEvent.update({
    where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } },
    data: { status: "FAILED", lastError: errorMessage(err) },
  });
  logger.error({ eventId, err }, "Event FAILED (definitive) — partition kept flowing");
}

export async function handleBookingEventMessage(
  message: ConsumedEventMessage,
  logger: Logger
): Promise<void> {
  const eventId = message.headers["event-id"];
  if (!eventId) {
    // Pas de clé d'idempotence : définitif par nature, on trace et on passe.
    logger.error(
      { topic: message.topic, partition: message.partition, offset: message.offset },
      "Message without event-id header — skipped"
    );
    return;
  }

  // 1. CLAIM (insert-first — l'unique composite fait le verrou)
  try {
    await prisma.consumedEvent.create({
      data: { consumerGroup: GROUP, eventId },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // transitoire → re-livraison
    const existing = await prisma.consumedEvent.findUnique({
      where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } },
    });
    if (existing?.status === "PROCESSED") {
      logger.info({ eventId }, "Duplicate delivery — skipped");
      return;
    }
    // PENDING ou FAILED : retraitement (les upserts sont rejouables).
  }

  // 2. PARSE au contrat réel — échec = définitif.
  let event: BookingDomainEvent;
  try {
    event = BookingDomainEventSchema.parse(JSON.parse(message.value ?? ""));
  } catch (err) {
    await markFailed(eventId, err, logger);
    return;
  }

  // 3. MATÉRIALISATION idempotente.
  const recipients = resolveRecipients(event);
  for (const userId of recipients) {
    await prisma.notification.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        userId,
        eventId,
        type: event.eventType,
        bookingId: event.payload.bookingId,
        payload: event.payload as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  // 4. PROCESSED — la row garde la trace du passage.
  await prisma.consumedEvent.update({
    where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });

  logger.info(
    {
      eventId,
      eventType: event.eventType,
      recipients: recipients.length,
      correlationId: event.correlationId,
    },
    "Event materialized"
  );
}
