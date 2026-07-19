import { Kafka, logLevel, type Producer } from "kafkajs";
import type { EventPublisher, PublishableEvent } from "./event-publisher";

/**
 * @packages/messaging — implémentation kafkajs (A24, PR4)
 * =======================================================
 * Seul fichier de la plateforme autorisé à importer kafkajs.
 *
 * Choix assumés :
 * - acks: -1 (tous les réplicas) : publish() ne résout qu'à l'ack
 *   complet — le prérequis du at-least-once du relay.
 * - allowAutoTopicCreation: false : doctrine A23, ceinture côté client
 *   en plus des bretelles côté cluster.
 * - idempotent: NON activé — marqué expérimental dans kafkajs ; notre
 *   garantie est at-least-once + dédup consumer par header event-id,
 *   pas exactly-once producteur. Réévaluer au changement de client.
 * - logLevel ERROR : pino est le canal de logs du service, kafkajs
 *   ne parle que quand ça brûle.
 */

export interface KafkaPublisherOptions {
  /** Ex. ["localhost:9092"] — depuis KAFKA_BROKERS (CSV) côté service. */
  brokers: string[];
  /** Identité du producteur côté broker — ex. "deal-service". */
  clientId: string;
}

export class KafkaEventPublisher implements EventPublisher {
  private readonly producer: Producer;

  constructor(options: KafkaPublisherOptions) {
    const kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
      logLevel: logLevel.ERROR,
    });
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async publish(event: PublishableEvent): Promise<void> {
    await this.producer.send({
      topic: event.topic,
      acks: -1,
      messages: [
        {
          key: event.key,
          value: event.value,
          headers: event.headers,
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}
