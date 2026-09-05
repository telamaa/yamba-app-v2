/**
 * messaging-events.consumer.ts — les messages deviennent des notifications (F-PR2, D61 6A)
 * =========================================================================================
 * Même discipline que le consumer booking (A25) : CLAIM d'abord (l'unique composite
 * `consumerGroup + eventId` fait le verrou), PARSE au contrat réel (échec = définitif, la
 * partition continue d'avancer), MATÉRIALISATION idempotente, PROCESSED.
 *
 * Ce que reçoit le destinataire (D61 6A) : une notification in-app immédiate, une seule par
 * événement. L'email de relance des messages non lus arrive en F-PR3 : sans écran pour le lire,
 * un email de message n'a pas encore de sens.
 */
import type { Logger } from "pino";
import { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { MessagingDomainEventSchema, type MessagingDomainEvent } from "@packages/api-contracts";
import { CONSUMER_GROUPS, type ConsumedEventMessage } from "@packages/messaging";
import { sinkToAnalytics } from "../lib/analytics-sink";

const GROUP = CONSUMER_GROUPS.MESSAGING_NOTIFICATIONS;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function markFailed(eventId: string, err: unknown, logger: Logger): Promise<void> {
  await prisma.consumedEvent.update({
    where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } },
    data: { status: "FAILED", lastError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500) },
  });
  logger.error({ eventId, err }, "Messaging event FAILED (definitive) — partition kept flowing");
}

/** Le fil ne notifie que l'AUTRE partie : l'auteur sait ce qu'il vient d'écrire. */
export function recipientOf(event: MessagingDomainEvent): string {
  return event.payload.recipientId;
}

export async function handleMessagingEventMessage(message: ConsumedEventMessage, logger: Logger): Promise<void> {
  const eventId = message.headers["event-id"];
  if (!eventId) {
    logger.error({ topic: message.topic, partition: message.partition, offset: message.offset }, "Message without event-id header — skipped");
    return;
  }

  try {
    await prisma.consumedEvent.create({ data: { consumerGroup: GROUP, eventId } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await prisma.consumedEvent.findUnique({ where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } } });
    if (existing?.status === "PROCESSED") {
      logger.info({ eventId }, "Duplicate delivery — skipped");
      return;
    }
  }

  let event: MessagingDomainEvent;
  try {
    event = MessagingDomainEventSchema.parse(JSON.parse(message.value ?? ""));
  } catch (err) {
    await markFailed(eventId, err, logger);
    return;
  }

  const userId = recipientOf(event);
  await prisma.notification.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      userId,
      eventId,
      type: event.eventType,
      bookingId: event.payload.bookingId,
      payload: event.payload as Prisma.InputJsonValue,
      // null EXPLICITE : sur Mongo, absent n'est pas null (pitfall connu).
      readAt: null,
    },
    update: {},
  });

  await prisma.consumedEvent.update({
    where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId } },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });

  await sinkToAnalytics({ eventId, eventType: event.eventType, occurredAt: event.occurredAt, payload: event.payload as never }, logger); // D66 4A
  logger.info({ eventId, eventType: event.eventType, userId, correlationId: event.correlationId }, "Messaging event materialized");
}
