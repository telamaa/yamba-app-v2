/**
 * orphan-holds.cron.ts — deux fois par heure, l'argent retenu pour rien est libéré (D82 9A)
 * =========================================================================================
 * Décalé de l'heure ronde ET des créneaux déjà pris (:05 les alertes, :17 la notation, :55 la
 * rétention) : deux passes qui lisent le fournisseur en même temps n'ont rien à y gagner, et
 * un poste contraint n'a pas à les subir ensemble.
 *
 * Deux fois par heure suffit : le délai de grâce est de deux heures, et la plus courte
 * rétention d'empreinte est de ~7 jours. On libère donc en quelques dizaines de minutes
 * après la grâce, très loin de toute expiration.
 */
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";
import type { OrphanHoldsService } from "../services/orphan-holds.service";

export const ORPHAN_HOLDS_CRON_SCHEDULE = "23,53 * * * *";

export function startOrphanHoldsCron(service: OrphanHoldsService, logger: Logger): ScheduledTask {
  const task = cron.schedule(ORPHAN_HOLDS_CRON_SCHEDULE, async () => {
    try {
      const r = await withHeartbeat(
        redis,
        { service: "deal-service", name: "orphan-holds", schedule: ORPHAN_HOLDS_CRON_SCHEDULE },
        () => service.runOnce(),
        (r) => `${r.canceled} empreinte(s) libérée(s) sur ${r.examined} lue(s)${r.failed ? `, ${r.failed} à retenter` : ""}`
      );
      if (r.canceled || r.failed) logger.warn(r, "Orphan payment holds released (D82 9A)");
    } catch (err) {
      logger.error({ err }, "Orphan holds cron failed");
    }
  });
  logger.info({ schedule: ORPHAN_HOLDS_CRON_SCHEDULE }, "Orphan holds cron started");
  return task;
}
