import { ZodError } from "zod";
import type { Logger } from "pino";
import type { OutboxEvent } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import { TOPICS, type EventPublisher } from "@packages/messaging";
import { buildLeaseOwner, releaseLease, tryAcquireLease } from "./relay-lease";

/**
 * outbox-relay.ts — le PRODUCTEUR de D2 (A23/A24, PR4)
 * ====================================================
 * Chaîne : transition (B2) → OutboxEvent (même transaction Mongo) →
 * CE RELAY → Redpanda `booking-events` → consumers (PR4bis+).
 *
 * Garanties tenues ici :
 * - AT-LEAST-ONCE : publishedAt posé APRÈS l'ack broker, par message.
 *   Un crash entre l'ack et l'update = republication ; les consumers
 *   dédupliquent via le header `event-id` (_id de la row).
 * - ORDRE PAR AGRÉGAT : batch trié occurredAt asc, publication
 *   SÉQUENTIELLE, clé de partition = aggregateId, et UN SEUL relay
 *   actif (lease — relay-lease.ts).
 * - VALIDATION AU CONTRAT : BookingDomainEventSchema.parse AVANT le
 *   broker — une divergence writer/contrat est un bug attrapé ici,
 *   jamais découvert chez un consumer.
 * - POISON PARKING : payload hors contrat ou erreur broker
 *   non-retriable → attempts++ ; à MAX_RELAY_ATTEMPTS la row est
 *   parquée (exclue de la requête, JAMAIS supprimée — audit trail).
 *   Une panne broker (retriable) n'incrémente JAMAIS attempts : elle
 *   déclenche le backoff du tick, pas le parking d'événements sains.
 * - RÉSILIENCE AU BOOT : connexion broker LAZY au premier tick
 *   détenteur du bail — l'API ne meurt pas si Redpanda est absent.
 *
 * Boucle en setTimeout chaîné (pas setInterval) : aucun tick ne peut
 * en chevaucher un autre. Backoff exponentiel 1 s → 30 s sur erreur,
 * reset au premier tick sain.
 */

export const RELAY_POLL_INTERVAL_MS = 1_000;
export const RELAY_BATCH_SIZE = 50;
export const MAX_RELAY_ATTEMPTS = 10;
export const RELAY_BACKOFF_MAX_MS = 30_000;

export interface OutboxRelayOptions {
  publisher: EventPublisher;
  logger: Logger;
  /** Surcharges pour les tests uniquement. */
  pollIntervalMs?: number;
  batchSize?: number;
}

export class OutboxRelay {
  private readonly publisher: EventPublisher;
  private readonly logger: Logger;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly owner = buildLeaseOwner();

  private stopped = false;
  private connected = false;
  private currentDelayMs: number;
  private timer: NodeJS.Timeout | null = null;
  private tickInFlight: Promise<void> = Promise.resolve();

  constructor(options: OutboxRelayOptions) {
    this.publisher = options.publisher;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? RELAY_POLL_INTERVAL_MS;
    this.batchSize = options.batchSize ?? RELAY_BATCH_SIZE;
    this.currentDelayMs = this.pollIntervalMs;
  }

  start(): void {
    this.logger.info({ owner: this.owner }, "Outbox relay starting");
    this.scheduleNext(0);
  }

  /** Arrêt propre : batch en vol terminé, bail libéré, producer déconnecté. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.tickInFlight;
    await releaseLease(this.owner).catch(() => undefined);
    if (this.connected) {
      await this.publisher.disconnect().catch(() => undefined);
    }
    this.logger.info({ owner: this.owner }, "Outbox relay stopped");
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    // unref : le timer ne retient pas le process à lui seul — c'est le
    // serveur HTTP qui porte la vie du service. Corollaire prouvé : les
    // specs qui appellent tick() n'empêchent plus jest de sortir.
    this.timer = setTimeout(() => {
      this.tickInFlight = this.tick();
    }, delayMs);
    this.timer.unref();
  }

  /** Exposé pour les tests (assertions de backoff) — lecture seule. */
  get currentBackoffMs(): number {
    return this.currentDelayMs;
  }

  /**
   * PUBLIC pour les tests uniquement (un tick = une unité testable :
   * lease → connexion lazy → drain → backoff). En production, seul
   * scheduleNext l'appelle — ne jamais l'invoquer à la main ailleurs.
   */
  async tick(): Promise<void> {
    try {
      const isLeader = await tryAcquireLease(this.owner);
      if (isLeader) {
        if (!this.connected) {
          await this.publisher.connect();
          this.connected = true;
          this.logger.info("Broker connection established");
        }
        await this.drainBatch();
      }
      this.currentDelayMs = this.pollIntervalMs; // tick sain → reset backoff
    } catch (err) {
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, RELAY_BACKOFF_MAX_MS);
      this.logger.error(
        { err, nextRetryMs: this.currentDelayMs },
        "Relay tick failed — backing off"
      );
    } finally {
      this.scheduleNext(this.currentDelayMs);
    }
  }

  private async drainBatch(): Promise<void> {
    const rows = await prisma.outboxEvent.findMany({
      // Pitfall Prisma+Mongo (CLAUDE.md, 3e occurrence — A49) : `null` ne
      // matche PAS un champ ABSENT ; les writers posent désormais `null`
      // explicitement, mais les documents antérieurs n'ont pas le champ.
      where: {
        OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }],
        attempts: { lt: MAX_RELAY_ATTEMPTS },
      },
      orderBy: { occurredAt: "asc" },
      take: this.batchSize,
    });

    for (const row of rows) {
      if (this.stopped) return; // arrêt demandé : on finit le message en cours, pas le batch
      try {
        const event = BookingDomainEventSchema.parse(row.payload);
        await this.publisher.publish({
          topic: TOPICS.BOOKING_EVENTS,
          key: row.aggregateId,
          value: JSON.stringify(event),
          headers: { "event-id": row.id },
        });
        await prisma.outboxEvent.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
        this.logger.info(
          {
            eventId: row.id,
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            correlationId: row.correlationId,
          },
          "Event published"
        );
      } catch (err) {
        await this.handlePublishError(row, err);
      }
    }
  }

  private async handlePublishError(row: OutboxEvent, err: unknown): Promise<void> {
    if (isPoison(err)) {
      const attempts = row.attempts + 1;
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { attempts, lastError: errorMessage(err), lastErrorAt: new Date() },
      });
      const parked = attempts >= MAX_RELAY_ATTEMPTS;
      this.logger.error(
        { eventId: row.id, eventType: row.eventType, aggregateId: row.aggregateId, attempts, parked },
        parked
          ? "Poison event PARKED — manual investigation required"
          : "Poison event, retrying next tick"
      );
      return; // un poison ne bloque pas la suite du batch
    }

    // Transitoire (broker down, réseau…) : tracé mais SANS attempts++,
    // puis remontée → le tick passe en backoff. Le .catch absorbe le
    // cas où Mongo lui-même est la cause (l'erreur d'origine prime).
    await prisma.outboxEvent
      .update({
        where: { id: row.id },
        data: { lastError: errorMessage(err), lastErrorAt: new Date() },
      })
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Poison = retenter ne changera JAMAIS le résultat :
 * - payload hors contrat (ZodError) = bug de writer ;
 * - erreur kafkajs marquée non-retriable (ex. message > max.message.bytes).
 * Tout le reste (connexion, timeout, metadata…) est transitoire.
 */
function isPoison(err: unknown): boolean {
  if (err instanceof ZodError) return true;
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { retriable?: boolean; name?: string };
  // PIÈGE observé au smoke PR4 (broker éteint) : kafkajs marque
  // retriable:false une simple panne de CONNEXION une fois ses retries
  // internes épuisés (KafkaJSNumberOfRetriesExceeded). Un broker
  // injoignable n'est JAMAIS un poison — sans cette exclusion, une
  // panne > MAX_RELAY_ATTEMPTS ticks parquerait des événements sains.
  if (
    candidate.name === "KafkaJSNumberOfRetriesExceeded" ||
    candidate.name === "KafkaJSConnectionError"
  ) {
    return false;
  }
  return candidate.retriable === false;
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return message.slice(0, 500); // borne : lastError est un champ d'audit, pas un dump
}
