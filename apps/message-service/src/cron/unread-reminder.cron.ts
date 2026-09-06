/**
 * unread-reminder.cron.ts — relance email toutes les 5 minutes (F-PR3, D61 6A)
 * ==============================================================================
 * Le service réclame chaque relance par verrou optimiste : deux instances ne relancent
 * jamais deux fois, aucun Redis nécessaire.
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { UnreadReminderService } from "../services/unread-reminder.service";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";


export const UNREAD_REMINDER_CRON_SCHEDULE = "*/5 * * * *";

export function startUnreadReminderCron(service: UnreadReminderService, logger: Logger): ScheduledTask {
  const task = cron.schedule(UNREAD_REMINDER_CRON_SCHEDULE, async () => {
    try {
      const result = await withHeartbeat(redis, { service: "message-service", name: "unread-reminder", schedule: UNREAD_REMINDER_CRON_SCHEDULE }, () => service.runOnce(), (r) => `${r.sent} relance(s), ${r.failed} échec(s)`);
      if (result.sent || result.failed) logger.info(result, "Unread message reminders sent");
    } catch (err) {
      logger.error({ err }, "Unread reminder cron failed");
    }
  });
  logger.info({ schedule: UNREAD_REMINDER_CRON_SCHEDULE }, "Unread reminder cron started");
  return task;
}
