/**
 * outbox-relay.spec.ts — preuves unitaires du producteur D2 (PR4, D30)
 * ====================================================================
 * Stratégie de mock :
 * - publisher : mock de l'INTERFACE EventPublisher (jamais kafkajs).
 * - prisma & @packages/messaging : mocks VIRTUELS — le préset jest
 *   résout @packages/api-contracts (prouvé par les 202 tests PR3) mais
 *   rien ne prouve qu'il résout les autres alias ; virtual: true
 *   court-circuite toute résolution.
 * - relay-lease : mock relatif (le bail a sa logique, testée via ses
 *   effets : leader/pas leader, release à l'arrêt).
 * - LE CONTRAT EST RÉEL : les fixtures passent le vrai
 *   BookingDomainEventSchema — si le contrat bouge, ces tests cassent,
 *   et c'est voulu.
 */
import { ZodError } from "zod";

const prismaMock = {
  outboxEvent: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), {
  virtual: true,
});
jest.mock(
  "@packages/messaging",
  () => ({ TOPICS: { BOOKING_EVENTS: "booking-events" } }),
  { virtual: true }
);
jest.mock("./relay-lease", () => ({
  buildLeaseOwner: () => "test-host#1#abcd1234",
  tryAcquireLease: jest.fn(),
  releaseLease: jest.fn(),
}));

import { releaseLease, tryAcquireLease } from "./relay-lease";
import {
  MAX_RELAY_ATTEMPTS,
  OutboxRelay,
  RELAY_BACKOFF_MAX_MS,
  RELAY_POLL_INTERVAL_MS,
} from "./outbox-relay";

const tryAcquireLeaseMock = tryAcquireLease as jest.Mock;
const releaseLeaseMock = releaseLease as jest.Mock;
const findManyMock = prismaMock.outboxEvent.findMany;
const updateMock = prismaMock.outboxEvent.update;

/* ── Fixtures : événement VALIDE au contrat réel ─────────────── */

const OID = {
  booking: "64b000000000000000000001",
  booking2: "64b000000000000000000002",
  trip: "64b000000000000000000010",
  shipper: "64b000000000000000000020",
  carrier: "64b000000000000000000030",
};

function validEventPayload(aggregateId: string, occurredAt: string) {
  return {
    aggregateType: "booking",
    aggregateId,
    occurredAt,
    correlationId: "spec",
    schemaVersion: 1,
    eventType: "booking.requested",
    payload: {
      bookingId: aggregateId,
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
      actor: "SHIPPER",
      expiresAt: "2026-07-20T10:00:00.000Z",
    },
  };
}

interface RowOverrides {
  id?: string;
  aggregateId?: string;
  occurredAt?: Date;
  attempts?: number;
  payload?: unknown;
  correlationId?: string | null;
}

function outboxRow(overrides: RowOverrides = {}) {
  const occurredAt = overrides.occurredAt ?? new Date("2026-07-19T10:00:00.000Z");
  const aggregateId = overrides.aggregateId ?? OID.booking;
  return {
    id: overrides.id ?? "6f0000000000000000000001",
    aggregateType: "booking",
    aggregateId,
    eventType: "booking.requested",
    payload:
      "payload" in overrides
        ? overrides.payload
        : validEventPayload(aggregateId, occurredAt.toISOString()),
    correlationId: overrides.correlationId ?? "spec",
    occurredAt,
    publishedAt: null,
    attempts: overrides.attempts ?? 0,
    lastError: null,
    lastErrorAt: null,
  };
}

function buildPublisher() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

function buildLogger() {
  const logger = { info: jest.fn(), error: jest.fn() };
  return logger as unknown as import("pino").Logger & typeof logger;
}

function buildRelay() {
  const publisher = buildPublisher();
  const logger = buildLogger();
  const relay = new OutboxRelay({ publisher, logger });
  return { relay, publisher, logger };
}

beforeEach(() => {
  jest.clearAllMocks();
  tryAcquireLeaseMock.mockResolvedValue(true);
  releaseLeaseMock.mockResolvedValue(undefined); // sans ça : .catch sur undefined → crash worker
  findManyMock.mockResolvedValue([]);
  updateMock.mockResolvedValue({});
});

/* ── Publication nominale ────────────────────────────────────── */

describe("publication nominale", () => {
  it("publie chaque événement pending avec topic, clé aggregateId et header event-id", async () => {
    const row = outboxRow();
    findManyMock.mockResolvedValue([row]);
    const { relay, publisher } = buildRelay();

    await relay.tick();

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const call = publisher.publish.mock.calls[0][0];
    expect(call.topic).toBe("booking-events");
    expect(call.key).toBe(OID.booking);
    expect(call.headers).toEqual({ "event-id": row.id });
    // La value est l'événement complet, revalidable au contrat
    expect(JSON.parse(call.value).eventType).toBe("booking.requested");
  });

  it("pose publishedAt APRÈS l'ack, message par message, dans l'ordre du batch", async () => {
    const first = outboxRow({ id: "6f0000000000000000000001", occurredAt: new Date("2026-07-19T10:00:00.000Z") });
    const second = outboxRow({
      id: "6f0000000000000000000002",
      aggregateId: OID.booking2,
      occurredAt: new Date("2026-07-19T10:00:01.000Z"),
    });
    findManyMock.mockResolvedValue([first, second]);
    const order: string[] = [];
    const { relay, publisher } = buildRelay();
    publisher.publish.mockImplementation(async (e: { headers: { "event-id": string } }) => {
      order.push(`publish:${e.headers["event-id"]}`);
    });
    updateMock.mockImplementation(async (args: { where: { id: string } }) => {
      order.push(`mark:${args.where.id}`);
      return {};
    });

    await relay.tick();

    expect(order).toEqual([
      `publish:${first.id}`,
      `mark:${first.id}`,
      `publish:${second.id}`,
      `mark:${second.id}`,
    ]);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: first.id },
        data: { publishedAt: expect.any(Date) },
      })
    );
  });

  it("interroge l'outbox trié occurredAt asc, borné au batch, hors rows parquées", async () => {
    const { relay } = buildRelay();

    await relay.tick();

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        // Chantier F (D61) : ce relais ne draine que SON domaine
        aggregateType: "booking",
        OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }],
        attempts: { lt: MAX_RELAY_ATTEMPTS },
      },
      orderBy: { occurredAt: "asc" },
      take: 50,
    });
  });

  it("ne publie RIEN quand le bail n'est pas acquis", async () => {
    tryAcquireLeaseMock.mockResolvedValue(false);
    const { relay, publisher } = buildRelay();

    await relay.tick();

    expect(findManyMock).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

/* ── Connexion lazy ──────────────────────────────────────────── */

describe("connexion broker lazy", () => {
  it("connecte au premier tick leader, puis jamais plus", async () => {
    const { relay, publisher } = buildRelay();

    await relay.tick();
    await relay.tick();

    expect(publisher.connect).toHaveBeenCalledTimes(1);
  });

  it("un échec de connexion déclenche le backoff sans tuer le relay", async () => {
    const { relay, publisher } = buildRelay();
    publisher.connect.mockRejectedValueOnce(new Error("broker unreachable"));

    await relay.tick();
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS * 2);

    // Le tick suivant retente la connexion (connected est resté false)
    await relay.tick();
    expect(publisher.connect).toHaveBeenCalledTimes(2);
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS);
  });
});

/* ── Poison handling ─────────────────────────────────────────── */

describe("poison handling (A24)", () => {
  it("payload hors contrat : attempts++ et lastError, le batch CONTINUE", async () => {
    const poison = outboxRow({ id: "6f00000000000000000000aa", payload: { broken: true } });
    const sane = outboxRow({
      id: "6f00000000000000000000bb",
      aggregateId: OID.booking2,
      occurredAt: new Date("2026-07-19T10:00:01.000Z"),
    });
    findManyMock.mockResolvedValue([poison, sane]);
    const { relay, publisher } = buildRelay();

    await relay.tick();

    // Le poison n'a jamais atteint le broker…
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish.mock.calls[0][0].headers["event-id"]).toBe(sane.id);
    // …et sa row porte la trace
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: poison.id },
        data: expect.objectContaining({
          attempts: 1,
          lastError: expect.stringContaining("ZodError"),
          lastErrorAt: expect.any(Date),
        }),
      })
    );
    // Tick sain malgré le poison → pas de backoff
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS);
  });

  it("parque à MAX_RELAY_ATTEMPTS et le signale en erreur", async () => {
    const poison = outboxRow({ payload: { broken: true }, attempts: MAX_RELAY_ATTEMPTS - 1 });
    findManyMock.mockResolvedValue([poison]);
    const { relay, logger } = buildRelay();

    await relay.tick();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: MAX_RELAY_ATTEMPTS }),
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ parked: true }),
      expect.stringContaining("PARKED")
    );
  });

  it("erreur kafkajs NON-retriable = poison (attempts++), pas backoff", async () => {
    const row = outboxRow();
    findManyMock.mockResolvedValue([row]);
    const { relay, publisher } = buildRelay();
    publisher.publish.mockRejectedValue(
      Object.assign(new Error("message too large"), { retriable: false })
    );

    await relay.tick();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: 1 }) })
    );
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS);
  });
});

/* ── Erreurs transitoires & backoff ──────────────────────────── */

describe("erreurs transitoires (broker down)", () => {
  it("JAMAIS d'attempts++ : lastError tracé, batch stoppé, backoff enclenché", async () => {
    const failing = outboxRow();
    const next = outboxRow({ id: "6f00000000000000000000cc", aggregateId: OID.booking2 });
    findManyMock.mockResolvedValue([failing, next]);
    const { relay, publisher } = buildRelay();
    publisher.publish.mockRejectedValue(new Error("connection refused"));

    await relay.tick();

    // Un seul essai de publication : le batch s'est arrêté net
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    // lastError sans attempts — une panne broker ne parque personne
    const dataWritten = updateMock.mock.calls[0][0].data;
    expect(dataWritten.lastError).toContain("connection refused");
    expect(dataWritten.attempts).toBeUndefined();
    expect(dataWritten.publishedAt).toBeUndefined();
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS * 2);
  });

  it("connexion épuisée PENDANT un publish (retriable:false kafkajs) reste TRANSITOIRE — jamais parqué", async () => {
    // Non-régression du piège observé au smoke PR4 : broker éteint,
    // kafkajs sort KafkaJSNumberOfRetriesExceeded avec retriable:false.
    const row = outboxRow();
    findManyMock.mockResolvedValue([row]);
    const { relay, publisher } = buildRelay();
    publisher.publish.mockRejectedValue(
      Object.assign(new Error("Connection error"), {
        name: "KafkaJSNumberOfRetriesExceeded",
        retriable: false,
      })
    );

    await relay.tick();

    const dataWritten = updateMock.mock.calls[0][0].data;
    expect(dataWritten.attempts).toBeUndefined();
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS * 2);
  });

  it("le backoff double jusqu'au plafond puis se réinitialise au tick sain", async () => {
    const { relay } = buildRelay();
    tryAcquireLeaseMock.mockRejectedValue(new Error("mongo down"));

    for (let i = 0; i < 10; i += 1) {
      await relay.tick();
    }
    expect(relay.currentBackoffMs).toBe(RELAY_BACKOFF_MAX_MS);

    tryAcquireLeaseMock.mockResolvedValue(true);
    await relay.tick();
    expect(relay.currentBackoffMs).toBe(RELAY_POLL_INTERVAL_MS);
  });
});

/* ── Arrêt propre ────────────────────────────────────────────── */

describe("arrêt propre", () => {
  it("stop() libère le bail avec le bon owner et déconnecte si connecté", async () => {
    const { relay, publisher } = buildRelay();
    await relay.tick(); // leader + connecté

    await relay.stop();

    expect(releaseLeaseMock).toHaveBeenCalledWith("test-host#1#abcd1234");
    expect(publisher.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stop() sans connexion établie ne tente pas de déconnexion", async () => {
    const { relay, publisher } = buildRelay();

    await relay.stop();

    expect(releaseLeaseMock).toHaveBeenCalledTimes(1);
    expect(publisher.disconnect).not.toHaveBeenCalled();
  });

  it("un arrêt en plein batch termine le message en cours puis s'interrompt", async () => {
    const first = outboxRow();
    const second = outboxRow({ id: "6f00000000000000000000dd", aggregateId: OID.booking2 });
    findManyMock.mockResolvedValue([first, second]);
    const { relay, publisher } = buildRelay();
    let stopPromise: Promise<void> | undefined;
    publisher.publish.mockImplementation(async () => {
      // L'arrêt arrive pendant la publication du premier message —
      // capturé puis attendu : un stop() flottant serait un rejet
      // non géré qui tuerait le worker jest.
      stopPromise = relay.stop();
    });

    await relay.tick();
    await stopPromise;

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    // Le premier message a bien été marqué malgré l'arrêt
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: first.id } })
    );
  });
});

/* ── Sanité de la fixture (méta-test) ────────────────────────── */

describe("fixture", () => {
  it("la fixture valide passe réellement le contrat (sinon tous les tests mentent)", async () => {
    const { BookingDomainEventSchema } = jest.requireActual("@packages/api-contracts");
    expect(() =>
      BookingDomainEventSchema.parse(validEventPayload(OID.booking, "2026-07-19T10:00:00.000Z"))
    ).not.toThrow();
    expect(() => BookingDomainEventSchema.parse({ broken: true })).toThrow(ZodError);
  });
});
