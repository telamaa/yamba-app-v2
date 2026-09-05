/** recipient-redaction.cron.ts — chaque nuit à 03:40, le tiers destinataire des deals finis s'efface (C-PR8b, D63 5A). */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { RecipientRedactionService } from "../services/recipient-redaction.service";

export const RECIPIENT_REDACTION_CRON_SCHEDULE = "40 3 * * *";

export function startRecipientRedactionCron(service: RecipientRedactionService, logger: Logger): ScheduledTask {
  const task = cron.schedule(RECIPIENT_REDACTION_CRON_SCHEDULE, async () => {
    try {
      const r = await service.runOnce();
      if (r.redacted) logger.info(r, "Recipient snapshots redacted (D63 5A)");
    } catch (err) {
      logger.error({ err }, "Recipient redaction cron failed");
    }
  });
  logger.info({ schedule: RECIPIENT_REDACTION_CRON_SCHEDULE }, "Recipient redaction cron started");
  return task;
}
