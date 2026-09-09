/**
 * event-consumer.ts — l'interface du CONSOMMATEUR (A25, PR4bis)
 * =============================================================
 * Miroir d'event-publisher.ts (A24) : les services consomment via CETTE
 * interface, jamais via kafkajs directement. Changer de client Kafka =
 * réécrire kafka-consumer.ts, zéro service ni test à toucher.
 *
 * Sémantique AT-LEAST-ONCE, côté consommation :
 * - le handler RÉSOUT  → l'offset est commité, on avance ;
 * - le handler JETTE   → l'offset n'est PAS commité, le message sera
 *   re-livré. Un handler ne jette donc que sur erreur TRANSITOIRE
 *   (base ou SMTP indisponibles) ; les erreurs définitives (contrat)
 *   se traitent SANS jeter — parking côté service, cf. ConsumedEvent.
 * - corollaire : tout traitement doit être IDEMPOTENT — la dédup se
 *   fait par le header `event-id` (posé par le relay, _id de l'outbox).
 */

/** Message brut livré par le broker, décodé en chaînes. */
export interface ConsumedEventMessage {
  topic: string;
  partition: number;
  /** Offset kafka du message (chaîne — c'est un int64). */
  offset: string;
  /** Clé de partition (aggregateId chez nous), null si absente. */
  key: string | null;
  /** Corps du message (JSON de l'événement), null si vide. */
  value: string | null;
  /** Headers décodés — dont `event-id`, la clé d'idempotence. */
  headers: Record<string, string | undefined>;
}

/** Le traitement d'UN message. Résoudre = commit ; jeter = re-livraison. */
export type ConsumedEventHandler = (
  message: ConsumedEventMessage
) => Promise<void>;

/**
 * Ce que le client rapporte quand la boucle de consommation MEURT après
 * son démarrage (ANO-CRON-08). `willRestart` dit si le client se relève
 * tout seul : kafkajs le fait pour une erreur retriable, jamais pour une
 * erreur définitive (une compression qu'il ne sait pas décoder, par ex.).
 */
export interface ConsumerCrash {
  error: unknown;
  willRestart: boolean;
}

export interface EventConsumer {
  connect(): Promise<void>;
  subscribe(topic: string): Promise<void>;
  /** Démarre la boucle de consommation — ne résout qu'au démarrage. */
  run(handler: ConsumedEventHandler): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * S'abonne aux plantages de la boucle. Sans cela, un consommateur mort
   * reste mort en silence : le processus vit, `/health` répond `ok`, et
   * plus rien n'est consommé (ANO-CRON-08, recette crons du 09/09/2026).
   */
  onCrash?(handler: (crash: ConsumerCrash) => void): void;
}
