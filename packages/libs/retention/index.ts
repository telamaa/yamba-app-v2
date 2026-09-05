/**
 * @packages/libs/retention — les durées de conservation, en règles pures (C-PR8c, D64 6A, RGP-01)
 * ==============================================================================================
 * Chaque service propriétaire purge ses collections, la nuit, avec le nombre de jours lu dans les
 * paramètres (`retention.*`, D62). Ces fonctions ne touchent pas la base : elles disent si UNE ligne
 * est purgeable. Un événement d'outbox jamais publié (parqué) n'est jamais purgé : piste d'audit.
 */
const DAY = 86_400_000;

export const olderThan = (at: Date | null | undefined, now: Date, days: number): boolean => !!at && at.getTime() < now.getTime() - days * DAY;

/** Notification in-app : par sa date de création, lue ou non. */
export const isNotificationPurgeable = (n: { createdAt: Date }, now: Date, days: number) => olderThan(n.createdAt, now, days);

/** Trace d'envoi d'email : par la date de réclamation (claimedAt), quel que soit le statut. */
export const isEmailDeliveryPurgeable = (e: { claimedAt: Date }, now: Date, days: number) => olderThan(e.claimedAt, now, days);

/** Registre d'idempotence des consumers : par la date de réclamation. */
export const isConsumedEventPurgeable = (e: { claimedAt: Date }, now: Date, days: number) => olderThan(e.claimedAt, now, days);

/** Événement d'outbox : publié ET assez ancien ; jamais un événement parqué (publishedAt absent). */
export const isOutboxEventPurgeable = (e: { publishedAt: Date | null; occurredAt: Date }, now: Date, days: number) => !!e.publishedAt && olderThan(e.publishedAt, now, days);

/** Borne de date pour un `deleteMany` : tout ce qui est strictement plus ancien. */
export const cutoffFor = (now: Date, days: number) => new Date(now.getTime() - days * DAY);
