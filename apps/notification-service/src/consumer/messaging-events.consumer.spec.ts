/**
 * messaging-events.consumer.spec.ts — notifications du chat (F-PR2, D61 6A)
 * ==========================================================================
 * Mêmes invariants que le consumer booking : claim d'abord, doublon ignoré, parse au contrat
 * réel (échec définitif, la partition avance), matérialisation idempotente pour l'AUTRE partie.
 */
const prismaMock = {
  consumedEvent: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  notification: { upsert: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { Prisma } from "@prisma/client";
import { handleMessagingEventMessage, recipientOf } from "./messaging-events.consumer";

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), child: jest.fn() } as never;
const SHIPPER = "64b0000000000000000000e1";
const CARRIER = "64b0000000000000000000c1";
const CONVERSATION = "64b0000000000000000000f1";
const BOOKING = "64b0000000000000000000b1";

const event = {
  aggregateType: "conversation",
  aggregateId: CONVERSATION,
  occurredAt: "2026-09-04T10:00:00.000Z",
  correlationId: null,
  schemaVersion: 1,
  eventType: "conversation.message_posted",
  payload: {
    conversationId: CONVERSATION,
    bookingId: BOOKING,
    shipperId: SHIPPER,
    carrierId: CARRIER,
    actorRole: "SHIPPER",
    actorId: SHIPPER,
    recipientId: CARRIER,
    corridor: { originCity: "Paris", destinationCity: "Brazzaville" },
    messageId: "64b0000000000000000000a9",
    preview: "Bonjour, le colis est pret.",
  },
};
const message = (value: unknown, eventId: string | null = "evt-1") => ({
  topic: "messaging-events",
  partition: 0,
  offset: "1",
  key: CONVERSATION,
  value: typeof value === "string" ? value : JSON.stringify(value),
  headers: eventId ? { "event-id": eventId } : {},
});

beforeEach(() => jest.clearAllMocks());

describe("messaging-events.consumer (F-PR2, D61 6A)", () => {
  it("notifie l'AUTRE partie, jamais l'auteur", () => {
    expect(recipientOf(event as never)).toBe(CARRIER);
  });

  it("sans event-id : ignoré, la partition continue d'avancer", async () => {
    await handleMessagingEventMessage(message(event, null) as never, logger);
    expect(prismaMock.consumedEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("matérialise une notification pour le destinataire, puis marque PROCESSED", async () => {
    prismaMock.consumedEvent.create.mockResolvedValue({});
    await handleMessagingEventMessage(message(event) as never, logger);
    const upsert = prismaMock.notification.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ eventId_userId: { eventId: "evt-1", userId: CARRIER } });
    expect(upsert.create).toMatchObject({ userId: CARRIER, type: "conversation.message_posted", bookingId: BOOKING, readAt: null });
    expect(prismaMock.consumedEvent.update.mock.calls[0][0].data).toMatchObject({ status: "PROCESSED" });
  });

  it("re-livraison d'un événement déjà traité : rien n'est réécrit", async () => {
    prismaMock.consumedEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }));
    prismaMock.consumedEvent.findUnique.mockResolvedValue({ status: "PROCESSED" });
    await handleMessagingEventMessage(message(event) as never, logger);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("payload invalide : échec DÉFINITIF (FAILED), sans notification", async () => {
    prismaMock.consumedEvent.create.mockResolvedValue({});
    await handleMessagingEventMessage(message({ ...event, payload: { ...event.payload, recipientId: "nope" } }) as never, logger);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    expect(prismaMock.consumedEvent.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });
});
