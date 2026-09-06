/**
 * messaging-relay.ts — outbox → Kafka pour les conversations (chantier F, D61)
 * ============================================================================
 * Même discipline que le relais du deal-service (A24), sur SON domaine :
 *  - lit uniquement `aggregateType: "conversation"` (le relais du deal-service, lui, ne lit
 *    que "booking" — sans ce partage, chaque relais empoisonnerait les événements de l'autre) ;
 *  - VALIDE au contrat avant publication : un payload invalide est un bug de writer ;
 *  - AT-LEAST-ONCE : `publishedAt` posé APRÈS l'accusé du broker, message par message ;
 *  - POISON : après MAX_RELAY_ATTEMPTS échecs, la ligne est PARQUÉE, jamais supprimée ;
 *  - BAIL : une seule instance draine à la fois (document RelayLease dédié).
 */
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import prisma from "@packages/libs/prisma";
import { MessagingDomainEventSchema } from "@packages/api-contracts";
import { TOPICS, type EventPublisher } from "@packages/messaging";

export const MESSAGING_RELAY_LEASE_ID = "messaging-relay";
export const MESSAGING_RELAY_POLL_MS = 2_000;
export const MESSAGING_RELAY_BATCH = 50;
export const MESSAGING_RELAY_LEASE_MS = 15_000;
export const MAX_RELAY_ATTEMPTS = 10;
export const RELAY_BACKOFF_MAX_MS = 30_000;

const buildOwner = () => `${hostname()}#${process.pid}#${randomUUID().slice(0, 8)}`;

/** Bail coopératif : un seul draineur à la fois, renouvelé à chaque tick, libéré à l'arrêt. */
export async function tryAcquireLease(owner: string, now: Date, ttlMs = MESSAGING_RELAY_LEASE_MS): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + ttlMs);
  const taken = await prisma.relayLease.updateMany({
    where: { id: MESSAGING_RELAY_LEASE_ID, OR: [{ owner }, { expiresAt: { lt: now } }] },
    data: { owner, expiresAt },
  });
  if (taken.count > 0) return true;
  try {
    await prisma.relayLease.create({ data: { id: MESSAGING_RELAY_LEASE_ID, owner, expiresAt } });
    return true;
  } catch {
    return false; // un concurrent l'a pris entre-temps
  }
}

export async function releaseLease(owner: string): Promise<void> {
  await prisma.relayLease.updateMany({ where: { id: MESSAGING_RELAY_LEASE_ID, owner }, data: { expiresAt: new Date(0) } });
}

export interface MessagingRelayOptions {
  publisher: EventPublisher;
  logger: Logger;
  pollIntervalMs?: number;
  batchSize?: number;
  clock?: () => Date;
}

export class MessagingOutboxRelay {
  private readonly publisher: EventPublisher;
  private readonly logger: Logger;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly clock: () => Date;
  private readonly owner = buildOwner();

  private stopped = false;
  private connected = false;
  private currentDelayMs: number;
  private timer: NodeJS.Timeout | null = null;
  private tickInFlight: Promise<void> = Promise.resolve();

  constructor(options: MessagingRelayOptions) {
    this.publisher = options.publisher;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? MESSAGING_RELAY_POLL_MS;
    this.batchSize = options.batchSize ?? MESSAGING_RELAY_BATCH;
    this.clock = options.clock ?? (() => new Date());
    this.currentDelayMs = this.pollIntervalMs;
  }

  start(): void {
    this.logger.info({ owner: this.owner }, "Messaging outbox relay starting");
    this.scheduleNext(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.tickInFlight;
    await releaseLease(this.owner).catch(() => undefined);
    if (this.connected) await this.publisher.disconnect().catch(() => undefined);
    this.logger.info({ owner: this.owner }, "Messaging outbox relay stopped");
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    // unref : le timer ne retient pas le process — c'est le serveur HTTP qui porte sa vie.
    this.timer = setTimeout(() => {
      this.tickInFlight = this.tick();
    }, delayMs);
    this.timer.unref();
  }

  get currentBackoffMs(): number {
    return this.currentDelayMs;
  }

  /** PUBLIC pour les tests : bail, connexion paresseuse, drain, backoff. */
  async tick(): Promise<void> {
    try {
      if (await tryAcquireLease(this.owner, this.clock())) {
        if (!this.connected) {
          await this.publisher.connect();
          this.connected = true;
          this.logger.info("Broker connection established");
        }
        await this.drainBatch();
      }
      this.currentDelayMs = this.pollIntervalMs;
    } catch (err) {
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, RELAY_BACKOFF_MAX_MS);
      this.logger.error({ err, nextRetryMs: this.currentDelayMs }, "Messaging relay tick failed — backing off");
    } finally {
      this.scheduleNext(this.currentDelayMs);
    }
  }

  private async drainBatch(): Promise<void> {
    const rows = await prisma.outboxEvent.findMany({
      where: {
        // Le domaine de CE relais, et lui seul.
        aggregateType: "conversation",
        // Pitfall Prisma+Mongo : `null` ne matche pas un champ ABSENT.
        OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }],
        attempts: { lt: MAX_RELAY_ATTEMPTS },
      },
      orderBy: { occurredAt: "asc" },
      take: this.batchSize,
    });

    for (const row of rows) {
      if (this.stopped) return;
      try {
        const event = MessagingDomainEventSchema.parse(row.payload);
        await this.publisher.publish({
          topic: TOPICS.MESSAGING_EVENTS,
          key: row.aggregateId,
          value: JSON.stringify(event),
          headers: { "event-id": row.id },
        });
        await prisma.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: this.clock() } });
        this.logger.info({ eventId: row.id, eventType: row.eventType }, "Messaging event published");
      } catch (err) {
        const attempts = row.attempts + 1;
        await prisma.outboxEvent.update({
          where: { id: row.id },
          data: { attempts, lastError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500), lastErrorAt: this.clock() },
        });
        if (attempts >= MAX_RELAY_ATTEMPTS) {
          this.logger.error({ eventId: row.id, eventType: row.eventType, attempts }, "Messaging event PARKED after max attempts");
        }
      }
    }
  }
}
