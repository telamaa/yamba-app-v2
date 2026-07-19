import type { TopicName } from "./topics";

/**
 * @packages/messaging — interface EventPublisher (A24, PR4)
 * =========================================================
 * LE contrat de publication que les services consomment. kafkajs est
 * un détail d'implémentation (kafka-publisher.ts) : il est en quasi-
 * maintenance depuis 2023, et une migration future (client Confluent
 * librdkafka…) doit être invisible pour le relay et les producteurs.
 * Les tests mockent CETTE interface, jamais kafkajs.
 *
 * Sémantique :
 * - publish() résout à l'ACK broker (acks=-1) — c'est le signal
 *   qu'attend le relay pour poser publishedAt (at-least-once).
 * - publish() rejette en cas d'échec — le relay gère backoff/parking,
 *   la lib ne retente JAMAIS d'elle-même (une seule politique de
 *   retry, au seul endroit qui connaît l'outbox).
 */

export interface PublishableEvent {
  topic: TopicName;
  /** Clé de partition — aggregateId : garantit l'ordre par agrégat. */
  key: string;
  /** L'événement complet sérialisé JSON (enveloppe + payload, validé au contrat par l'appelant). */
  value: string;
  /**
   * Headers Kafka — hors contrat de payload. "event-id" = _id de
   * l'OutboxEvent : la clé d'idempotence des consumers (at-least-once).
   */
  headers: {
    "event-id": string;
  };
}

export interface EventPublisher {
  /** Connexion au broker — à appeler une fois avant le premier publish. */
  connect(): Promise<void>;
  /** Publie UN événement ; résout à l'ack broker, rejette sinon. */
  publish(event: PublishableEvent): Promise<void>;
  /** Déconnexion propre (arrêt du service — SIGTERM/SIGINT). */
  disconnect(): Promise<void>;
}
