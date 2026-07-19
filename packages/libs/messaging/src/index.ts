/**
 * @packages/messaging — point d'entrée (A24, PR4)
 * ===============================================
 * Plomberie de messagerie de la plateforme : topics, interface
 * EventPublisher, implémentation kafkajs. Volontairement AGNOSTIQUE
 * des contrats métier : cette lib ne dépend PAS d'api-contracts (et
 * réciproquement) — la validation des payloads appartient aux
 * producteurs (relay) et aux consumers, pas au tuyau.
 * Grandira en PR4bis : consumer wrapper pour notification-service.
 */

export { TOPICS, type TopicName } from "./topics";
export type { EventPublisher, PublishableEvent } from "./event-publisher";
export { KafkaEventPublisher, type KafkaPublisherOptions } from "./kafka-publisher";
