/**
 * retention.cron.ts — purge nocturne du notification-service (C-PR8c, D64 6A)
 * ============================================================================
 * 03:50 : notifications in-app, traces d'emails, registre des événements consommés — chaque durée
 * lue dans les paramètres (`retention.*`). Un `deleteMany` borné par date, jamais de boucle.
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";
import { cutoffFor } from "@packages/libs/retention";
import { platformSettings } from "@packages/libs/settings/default";
import type { SettingsReader } from "@packages/libs/settings";

export const RETENTION_CRON_SCHEDULE = "50 3 * * *";

export function makeRetentionService(clock: () => Date = () => new Date(), settings: SettingsReader = platformSettings()) {
  return {
    async runOnce(now: Date = clock()): Promise<{ notifications: number; emailDeliveries: number; consumedEvents: number }> {
      const v = await settings.get();
      const [n, e, c] = await Promise.all([
        prisma.notification.deleteMany({ where: { createdAt: { lt: cutoffFor(now, v["retention.notificationsDays"]) } } }),
        prisma.emailDelivery.deleteMany({ where: { claimedAt: { lt: cutoffFor(now, v["retention.emailDeliveriesDays"]) } } }),
        prisma.consumedEvent.deleteMany({ where: { claimedAt: { lt: cutoffFor(now, v["retention.consumedEventsDays"]) } } }),
      ]);
      return { notifications: n.count, emailDeliveries: e.count, consumedEvents: c.count };
    },
  };
}
export type RetentionService = ReturnType<typeof makeRetentionService>;

export function startRetentionCron(service: RetentionService, logger: Logger): ScheduledTask {
  const task = cron.schedule(RETENTION_CRON_SCHEDULE, async () => {
    try {
      const r = await withHeartbeat(redis, { service: "notification-service", name: "retention", schedule: RETENTION_CRON_SCHEDULE }, () => service.runOnce(), (r) => `${r.notifications} notification(s), ${r.emailDeliveries} trace(s) d'email, ${r.consumedEvents} événement(s) consommé(s)`);
      if (r.notifications || r.emailDeliveries || r.consumedEvents) logger.info(r, "Retention purge (D64 6A)");
    } catch (err) {
      logger.error({ err }, "Retention cron failed");
    }
  });
  logger.info({ schedule: RETENTION_CRON_SCHEDULE }, "Retention cron started");
  return task;
}
