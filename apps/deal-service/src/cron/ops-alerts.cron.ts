/**
 * ops-alerts.cron.ts — évaluation horaire des alertes de seuil (C-PR6b, D59 3A)
 * =============================================================================
 * Toutes les heures : évalue les règles, envoie UN email au support pour celles qui apparaissent
 * pour la première fois dans la journée (dédoublonnage Redis, injecté). Désactivable :
 * OPS_ALERTS_CRON_ENABLED=false. L'accueil admin, lui, recalcule à chaque lecture (4A).
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { AlertDedupStore, OpsAlertsService } from "../services/ops-alerts.service";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";


export const OPS_ALERTS_CRON_SCHEDULE = "5 * * * *";

export function startOpsAlertsCron(service: OpsAlertsService, store: AlertDedupStore, logger: Logger): ScheduledTask {
  const task = cron.schedule(OPS_ALERTS_CRON_SCHEDULE, async () => {
    try {
      const sent = await withHeartbeat(redis, { service: "deal-service", name: "ops-alerts", schedule: OPS_ALERTS_CRON_SCHEDULE }, () => service.notifyNewAlerts(store), (r) => (r.length ? `${r.length} nouvelle(s) alerte(s)` : "aucune nouvelle alerte"));
      if (sent.length) logger.warn({ rules: sent }, "Ops alerts: new alerts notified to support");
    } catch (err) {
      logger.error({ err }, "Ops alerts cron failed");
    }
  });
  logger.info({ schedule: OPS_ALERTS_CRON_SCHEDULE }, "Ops alerts cron started");
  return task;
}
