/**
 * @packages/messaging — point d'entrée (A24/A25, PR4 + PR4bis)
 * ============================================================
 * Plomberie de messagerie de la plateforme : topics, groupes de
 * consommation, interfaces EventPublisher/EventConsumer,
 * implémentations kafkajs. Volontairement AGNOSTIQUE des contrats
 * métier : cette lib ne dépend PAS d'api-contracts (et
 * réciproquement) — la validation des payloads appartient aux
 * producteurs (relay) et aux consumers, pas au tuyau.
 */
export { TOPICS, type TopicName } from "./topics";
export type { EventPublisher, PublishableEvent } from "./event-publisher";
export { KafkaEventPublisher, type KafkaPublisherOptions } from "./kafka-publisher";
export { CONSUMER_GROUPS } from "./consumer-groups";
export type {
  ConsumedEventHandler,
  ConsumedEventMessage,
  EventConsumer,
} from "./event-consumer";
export { KafkaEventConsumer, type KafkaEventConsumerOptions } from "./kafka-consumer";
