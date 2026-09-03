/**
 * ops-digest.cron.ts — récapitulatif quotidien « argent à surveiller » (A88)
 * =========================================================================
 * Tous les jours à 08:00 UTC : versements FAILED depuis > 24 h, transferts
 * renversés, retenues « à arbitrer » → email à SUPPORT_EMAIL. Filet de
 * sécurité tant que l'admin (chantier C) n'existe pas. Désactivable :
 * OPS_DIGEST_CRON_ENABLED=false.
 */

import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { DealSettlementService } from "../services/deal-settlement.service";
import { sendOpsDigest } from "../services/ops-notify.service";

export const OPS_DIGEST_CRON_SCHEDULE = "0 8 * * *";

export function startOpsDigestCron(service: DealSettlementService, logger: Logger): ScheduledTask {
  const task = cron.schedule(OPS_DIGEST_CRON_SCHEDULE, async () => {
    try {
      const digest = await service.collectOpsDigest();
      const sent = await sendOpsDigest(digest, new Date());
      logger.info({ failed: digest.failed.length, reversed: digest.reversed.length, held: digest.held.length, sent }, "Ops digest run");
    } catch (err) {
      logger.error({ err }, "Ops digest cron failed");
    }
  });
  logger.info({ schedule: OPS_DIGEST_CRON_SCHEDULE }, "Ops digest cron started");
  return task;
}
