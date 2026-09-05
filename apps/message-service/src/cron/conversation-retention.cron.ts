/**
 * conversation-retention.cron.ts — purge nocturne à un an (F-PR3, D61 8A)
 * =========================================================================
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { ConversationRetentionService } from "../services/conversation-retention.service";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";


export const CONVERSATION_RETENTION_CRON_SCHEDULE = "30 3 * * *";

export function startConversationRetentionCron(service: ConversationRetentionService, logger: Logger): ScheduledTask {
  const task = cron.schedule(CONVERSATION_RETENTION_CRON_SCHEDULE, async () => {
    try {
      const result = await withHeartbeat(redis, { service: "message-service", name: "conversation-retention", schedule: CONVERSATION_RETENTION_CRON_SCHEDULE }, () => service.purgeOnce(), (r) => `${r.purged} conversation(s) purgée(s) sur ${r.examined}`);
      if (result.purged) logger.info(result, "Conversations purged (retention)");
    } catch (err) {
      logger.error({ err }, "Conversation retention cron failed");
    }
  });
  logger.info({ schedule: CONVERSATION_RETENTION_CRON_SCHEDULE }, "Conversation retention cron started");
  return task;
}
