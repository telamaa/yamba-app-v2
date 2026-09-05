/**
 * rating.cron.ts — relances de notation J+5 / J+7 et révélation à 14 jours (B5, D53)
 * ===================================================================================
 * Toutes les heures : (1) relances aux rôles qui n'ont pas noté, (2) fin de
 * fenêtre → avis révélés (même si un seul a noté). Même patron
 * anti-chevauchement que les autres crons. RATING_CRON_ENABLED=false pour couper.
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { DealRatingService } from "../services/deal-rating.service";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";


export const RATING_CRON_SCHEDULE = "17 * * * *";

export function startRatingCron(service: DealRatingService, logger: Logger): ScheduledTask {
  let running = false;
  const task = cron.schedule(RATING_CRON_SCHEDULE, async () => {
    if (running) return;
    running = true;
    try {
      const { reminded, revealed } = await withHeartbeat(redis, { service: "deal-service", name: "rating", schedule: RATING_CRON_SCHEDULE }, async () => ({ reminded: await service.sendRatingReminders(), revealed: await service.revealElapsed() }), (r) => `${r.reminded} relance(s), ${r.revealed} révélation(s)`);
      if (reminded > 0 || revealed > 0) logger.info({ reminded, revealed }, "Rating cron run");
    } catch (err) {
      logger.error({ err }, "Rating cron failed");
    } finally {
      running = false;
    }
  });
  logger.info({ schedule: RATING_CRON_SCHEDULE }, "Rating cron started");
  return task;
}
