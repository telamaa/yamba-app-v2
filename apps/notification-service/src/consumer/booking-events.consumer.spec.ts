/**
 * booking-events.consumer.spec.ts — preuves du premier consumer (PR4bis, D30)
 * ===========================================================================
 * Miroir du spec relay (PR4) :
 * - prisma & @packages/messaging : mocks VIRTUELS (seul
 *   api-contracts est prouvé résolu par le préset jest) ;
 * - LE CONTRAT EST RÉEL : les fixtures passent le vrai
 *   BookingDomainEventSchema (méta-test) — si le contrat bouge,
 *   ces tests cassent, et c'est voulu ;
 * - le routage (resolveRecipients) se teste avec des événements
 *   minimaux CASTÉS : on teste la TABLE, pas le parse.
 */
import { Prisma } from "@prisma/client";

const prismaMock = {
  consumedEvent: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    upsert: jest.fn(),
  },
};
jest.mock(
  "@packages/libs/prisma",
  () => ({ __esModule: true, default: prismaMock }),
  { virtual: true }
);
jest.mock(
  "@packages/messaging",
  () => ({ CONSUMER_GROUPS: { NOTIFICATION_SERVICE: "notification-service" } }),
  { virtual: true }
);

import { BookingDomainEventSchema } from "@packages/api-contracts";
import {
  GROUP,
  IN_APP_MATRIX,
  handleBookingEventMessage,
  resolveRecipients,
} from "./booking-events.consumer";

/* ── Fixtures : événements VALIDES au contrat réel ───────────── */

const OID = {
  booking: "64b000000000000000000001",
  trip: "64b000000000000000000010",
  shipper: "64b000000000000000000020",
  carrier: "64b000000000000000000030",
};
const EVENT_ID = "6f0000000000000000000001";

function basePayload() {
  return {
    bookingId: OID.booking,
    tripId: OID.trip,
    shipperId: OID.shipper,
    carrierId: OID.carrier,
    corridor: {
      originCity: "Paris",
      originCountryCode: "FR",
      destinationCity: "Brazzaville",
      destinationCountryCode: "CG",
    },
    category: "DOCUMENTS",
    categoryFamily: null,
    weightKg: 2.5,
    transportCents: 3000,
    totalShipperCents: 3900,
    currencyCode: "EUR",
    actor: "SHIPPER" as const,
  };
}

function requestedEvent() {
  return {
    aggregateType: "booking",
    aggregateId: OID.booking,
    occurredAt: "2026-07-19T10:00:00.000Z",
    correlationId: "spec",
    schemaVersion: 1,
    eventType: "booking.requested",
    payload: { ...basePayload(), expiresAt: "2026-07-20T10:00:00.000Z" },
  };
}

function ratingReminderEvent(targetRole: "SHIPPER" | "CARRIER") {
  return {
    aggregateType: "booking",
    aggregateId: OID.booking,
    occurredAt: "2026-07-19T10:00:00.000Z",
    correlationId: "spec",
    schemaVersion: 1,
    eventType: "booking.rating_reminder",
    payload: {
      ...basePayload(),
      actor: "SYSTEM" as const,
      reminderNumber: 1,
      targetRole,
    },
  };
}

function makeMessage(
  value: unknown,
  headers: Record<string, string | undefined> = { "event-id": EVENT_ID }
) {
  return {
    topic: "booking-events",
    partition: 3,
    offset: "0",
    key: OID.booking,
    value: typeof value === "string" ? value : JSON.stringify(value),
    headers,
  };
}

function buildLogger() {
  const logger = { info: jest.fn(), error: jest.fn() };
  return logger as unknown as import("pino").Logger & typeof logger;
}

/** Événement minimal CASTÉ — pour tester la table de routage seule. */
function routeEvent(eventType: string, extra: Record<string, unknown> = {}) {
  return {
    eventType,
    payload: { shipperId: OID.shipper, carrierId: OID.carrier, ...extra },
  } as unknown as Parameters<typeof resolveRecipients>[0];
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.consumedEvent.create.mockResolvedValue({});
  prismaMock.consumedEvent.findUnique.mockResolvedValue(null);
  prismaMock.consumedEvent.update.mockResolvedValue({});
  prismaMock.notification.upsert.mockResolvedValue({});
});

/* ── Contrat & matrice ───────────────────────────────────────── */

describe("contrat & matrice", () => {
  it("méta-test : les fixtures passent le VRAI contrat (sinon tous les tests mentent)", () => {
    expect(() => BookingDomainEventSchema.parse(requestedEvent())).not.toThrow();
    expect(() =>
      BookingDomainEventSchema.parse(ratingReminderEvent("CARRIER"))
    ).not.toThrow();
  });

  it("la matrice couvre les 17 événements du contrat", () => {
    expect(Object.keys(IN_APP_MATRIX)).toHaveLength(17);
  });

  it("route CARRIER : booking.requested → transporteur seul", () => {
    expect(resolveRecipients(routeEvent("booking.requested"))).toEqual([
      OID.carrier,
    ]);
  });

  it("route SHIPPER : booking.accepted → expéditeur seul", () => {
    expect(resolveRecipients(routeEvent("booking.accepted"))).toEqual([
      OID.shipper,
    ]);
  });

  it("route BOTH : booking.cancelled → les deux", () => {
    expect(resolveRecipients(routeEvent("booking.cancelled"))).toEqual([
      OID.shipper,
      OID.carrier,
    ]);
  });

  it("route NONE : booking.payment_authorized → personne (email only, A27)", () => {
    expect(resolveRecipients(routeEvent("booking.payment_authorized"))).toEqual([]);
  });

  it("route TARGET_ROLE : rating_reminder suit targetRole", () => {
    expect(
      resolveRecipients(routeEvent("booking.rating_reminder", { targetRole: "CARRIER" }))
    ).toEqual([OID.carrier]);
    expect(
      resolveRecipients(routeEvent("booking.rating_reminder", { targetRole: "SHIPPER" }))
    ).toEqual([OID.shipper]);
  });
});

/* ── Pipeline nominal ────────────────────────────────────────── */

describe("pipeline nominal", () => {
  it("claim → upsert destinataire → PROCESSED, clés composites exactes", async () => {
    const logger = buildLogger();

    await handleBookingEventMessage(makeMessage(requestedEvent()), logger);

    expect(prismaMock.consumedEvent.create).toHaveBeenCalledWith({
      data: { consumerGroup: GROUP, eventId: EVENT_ID },
    });
    expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
    const upsert = prismaMock.notification.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({
      eventId_userId: { eventId: EVENT_ID, userId: OID.carrier },
    });
    expect(upsert.create.type).toBe("booking.requested");
    expect(upsert.create.bookingId).toBe(OID.booking);
    expect(prismaMock.consumedEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { consumerGroup_eventId: { consumerGroup: GROUP, eventId: EVENT_ID } },
        data: expect.objectContaining({ status: "PROCESSED" }),
      })
    );
  });

  it("rating_reminder RÉEL bout en bout : notifié = targetRole", async () => {
    const logger = buildLogger();

    await handleBookingEventMessage(
      makeMessage(ratingReminderEvent("CARRIER")),
      logger
    );

    const upsert = prismaMock.notification.upsert.mock.calls[0][0];
    expect(upsert.where.eventId_userId.userId).toBe(OID.carrier);
  });

  it("message SANS event-id : tracé, aucun accès base", async () => {
    const logger = buildLogger();

    await handleBookingEventMessage(makeMessage(requestedEvent(), {}), logger);

    expect(prismaMock.consumedEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});

/* ── Idempotence claim-first ─────────────────────────────────── */

describe("idempotence claim-first", () => {
  it("doublon PROCESSED : skip total (ni upsert, ni update)", async () => {
    prismaMock.consumedEvent.create.mockRejectedValue(p2002());
    prismaMock.consumedEvent.findUnique.mockResolvedValue({ status: "PROCESSED" });

    await handleBookingEventMessage(makeMessage(requestedEvent()), buildLogger());

    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    expect(prismaMock.consumedEvent.update).not.toHaveBeenCalled();
  });

  it("claim existant PENDING (crash antérieur) : retraitement complet", async () => {
    prismaMock.consumedEvent.create.mockRejectedValue(p2002());
    prismaMock.consumedEvent.findUnique.mockResolvedValue({ status: "PENDING" });

    await handleBookingEventMessage(makeMessage(requestedEvent()), buildLogger());

    expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.consumedEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) })
    );
  });

  it("claim existant FAILED : retraitement autorisé (rejeu manuel)", async () => {
    prismaMock.consumedEvent.create.mockRejectedValue(p2002());
    prismaMock.consumedEvent.findUnique.mockResolvedValue({ status: "FAILED" });

    await handleBookingEventMessage(makeMessage(requestedEvent()), buildLogger());

    expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
  });
});

/* ── Erreurs : définitives vs transitoires ───────────────────── */

describe("erreurs définitives vs transitoires", () => {
  it("JSON cassé = DÉFINITIF : FAILED + lastError, pas de throw, partition libre", async () => {
    const logger = buildLogger();

    await expect(
      handleBookingEventMessage(makeMessage("{pas du json"), logger)
    ).resolves.toBeUndefined();

    expect(prismaMock.consumedEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("payload hors contrat (ZodError) = DÉFINITIF : FAILED, pas de throw", async () => {
    const invalid = { ...requestedEvent(), payload: { bad: true } };

    await expect(
      handleBookingEventMessage(makeMessage(invalid), buildLogger())
    ).resolves.toBeUndefined();

    const update = prismaMock.consumedEvent.update.mock.calls[0][0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.lastError).toBeTruthy();
  });

  it("claim en erreur TRANSITOIRE (Mongo down) : throw → re-livraison", async () => {
    prismaMock.consumedEvent.create.mockRejectedValue(new Error("connection refused"));

    await expect(
      handleBookingEventMessage(makeMessage(requestedEvent()), buildLogger())
    ).rejects.toThrow("connection refused");

    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("upsert en erreur TRANSITOIRE : throw, claim reste PENDING (jamais PROCESSED)", async () => {
    prismaMock.notification.upsert.mockRejectedValue(new Error("socket closed"));

    await expect(
      handleBookingEventMessage(makeMessage(requestedEvent()), buildLogger())
    ).rejects.toThrow("socket closed");

    expect(prismaMock.consumedEvent.update).not.toHaveBeenCalled();
  });
});
