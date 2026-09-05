/**
 * analytics-sink.ts — les événements outbox partent vers PostHog pour les parties consentantes (D66 4A)
 * ====================================================================================================
 * Appelé après la matérialisation par les deux consumers ; best effort, jamais bloquant.
 */
import prisma from "@packages/libs/prisma";
import { analyticsEventsFor, captureServerEvents, isAnalyticsEnabled, partiesOf, type OutboxLikeEvent } from "@packages/libs/analytics";

export async function sinkToAnalytics(e: OutboxLikeEvent, log: { warn(o: unknown, m: string): void }): Promise<number> {
  if (!isAnalyticsEnabled()) return 0;
  try {
    const parties = partiesOf(e);
    if (parties.length === 0) return 0;
    const consenting = await prisma.user.findMany({ where: { id: { in: parties }, analyticsOptIn: true, isDeleted: false }, select: { id: true } });
    const events = analyticsEventsFor(e, consenting.map((u) => u.id));
    if (events.length === 0) return 0;
    await captureServerEvents(events, { onError: (err) => log.warn({ err, eventId: e.eventId }, "PostHog capture failed") });
    return events.length;
  } catch (err) {
    log.warn({ err, eventId: e.eventId }, "Analytics sink failed");
    return 0;
  }
}
