/**
 * consumer-groups.ts — registre des groupes de consommation (A25)
 * Un groupId par SERVICE consommateur, JAMAIS partagé, JAMAIS
 * renommé (renommer = perdre les offsets = tout retraiter).
 * Miroir du registre des topics (topics.ts).
 */
export const CONSUMER_GROUPS = {
  NOTIFICATION_SERVICE: "notification-service",
} as const;
