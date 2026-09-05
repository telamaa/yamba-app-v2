/** outbox-retention.cron.ts — purge des événements `booking` déjà publiés (C-PR8c, D64 6A) ; un parqué n'est jamais supprimé. */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";
import { cutoffFor } from "@packages/libs/retention";
import { platformSettings } from "@packages/libs/settings/default";

export const OUTBOX_RETENTION_CRON_SCHEDULE = "55 3 * * *";

export async function purgePublishedOutbox(aggregateType: string, now: Date = new Date()): Promise<number> {
  const days = (await platformSettings().get())["retention.outboxPublishedDays"];
  const r = await prisma.outboxEvent.deleteMany({ where: { aggregateType, publishedAt: { lt: cutoffFor(now, days) } } });
  return r.count;
}

export function startOutboxRetentionCron(aggregateType: string, service: string, logger: Logger): ScheduledTask {
  const task = cron.schedule(OUTBOX_RETENTION_CRON_SCHEDULE, async () => {
    try {
      const purged = await withHeartbeat(redis, { service, name: "outbox-retention", schedule: OUTBOX_RETENTION_CRON_SCHEDULE }, () => purgePublishedOutbox(aggregateType), (n) => `${n} événement(s) publié(s) purgé(s)`);
      if (purged) logger.info({ purged, aggregateType }, "Outbox retention purge (D64 6A)");
    } catch (err) {
      logger.error({ err }, "Outbox retention cron failed");
    }
  });
  logger.info({ schedule: OUTBOX_RETENTION_CRON_SCHEDULE, aggregateType }, "Outbox retention cron started");
  return task;
}
