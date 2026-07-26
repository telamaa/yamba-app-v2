/**
 * kafka-consumer.ts — implémentation kafkajs de EventConsumer
 * ============================================================
 * DEUXIÈME et DERNIER fichier de la plateforme autorisé à importer
 * kafkajs (avec kafka-publisher.ts — règle A24 amendée en PR4bis).
 *
 * Choix gravés ici :
 * - allowAutoTopicCreation: false — A23 vaut aussi côté consumer :
 *   un topic absent est une ERREUR d'infra, jamais une création.
 * - fromBeginning: true — au PREMIER démarrage d'un groupe (aucun
 *   offset commité), on lit depuis le début : les événements publiés
 *   avant la naissance du service sont traités (smoke E2E du seed).
 *   Dès le premier commit, les offsets du groupe priment — ce flag
 *   n'a plus d'effet.
 * - eachMessage : un handler qui jette empêche le commit de l'offset
 *   → kafkajs re-livre après restart de la partition. C'est le
 *   comportement voulu (at-least-once), réservé aux erreurs
 *   transitoires.
 */
import { Kafka, type Consumer } from "kafkajs";
import type {
  ConsumedEventHandler,
  ConsumedEventMessage,
  EventConsumer,
} from "./event-consumer";

export interface KafkaEventConsumerOptions {
  brokers: string[];
  clientId: string;
  /** JAMAIS renommé : le renommer = perdre les offsets (A25). */
  groupId: string;
}

export class KafkaEventConsumer implements EventConsumer {
  private readonly consumer: Consumer;

  constructor(options: KafkaEventConsumerOptions) {
    const kafka = new Kafka({
      brokers: options.brokers,
      clientId: options.clientId,
    });
    this.consumer = kafka.consumer({
      groupId: options.groupId,
      allowAutoTopicCreation: false,
    });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
  }

  async subscribe(topic: string): Promise<void> {
    await this.consumer.subscribe({ topic, fromBeginning: true });
  }

  async run(handler: ConsumedEventHandler): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const headers: Record<string, string | undefined> = {};
        for (const [name, raw] of Object.entries(message.headers ?? {})) {
          headers[name] = raw?.toString();
        }
        const consumed: ConsumedEventMessage = {
          topic,
          partition,
          offset: message.offset,
          key: message.key ? message.key.toString() : null,
          value: message.value ? message.value.toString() : null,
          headers,
        };
        await handler(consumed);
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
