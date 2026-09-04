/**
 * @packages/messaging — registre des topics (A23, PR4)
 * ====================================================
 * Source UNIQUE des noms de topics de la plateforme. Un topic par
 * domaine (booking-events, plus tard trip-events…), jamais de topic
 * par eventType : l'ordre par agrégat est l'invariant, le dispatch
 * par type est fait par les consumers via le discriminatedUnion des
 * contrats. Surface publique → noms en ANGLAIS.
 *
 * Création : EXPLICITE uniquement (scripts/redpanda-bootstrap.sh —
 * 12 partitions, rétention 7 j). L'auto-création est désactivée côté
 * cluster ET côté producer (allowAutoTopicCreation: false).
 */

export const TOPICS = {
  /** Les 17 événements booking (BookingDomainEventSchema). Clé = aggregateId. */
  BOOKING_EVENTS: "booking-events",
  /** Chantier F (D61) — événements de conversation (MessagingDomainEventSchema). Clé = conversationId. */
  MESSAGING_EVENTS: "messaging-events",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
