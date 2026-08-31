/**
 * expire-bookings.cron.ts — expiration 24 h des demandes (DEA-01, B2-PR2)
 * =======================================================================
 * Emplacement : apps/deal-service/src/cron/expire-bookings.cron.ts
 *
 * Toutes les 5 minutes : les PENDING dont `expiresAt` est passé →
 * EXPIRED (libération de l'empreinte, kg restitués CAP-02, outbox
 * booking.expired + booking.refund_issued — le tout via le service de
 * cycle de vie, machine comprise).
 *
 * La précision fine n'est PAS ici : la machine traite déjà un PENDING
 * périmé comme EXPIRED avant le passage du cron (guard notExpired) — le
 * cron ne fait que MATÉRIALISER l'état et libérer l'argent/les kg.
 *
 * Anti-chevauchement : un run encore en vol saute le tick suivant
 * (fournées de 50 ; le retard se résorbe au tick d'après).
 * Désactivable : BOOKING_EXPIRY_CRON_ENABLED=false (instances API pures,
 * même logique que OUTBOX_RELAY_ENABLED).
 */

import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { DealLifecycleService } from "../services/deal-lifecycle.service";

export const BOOKING_EXPIRY_CRON_SCHEDULE = "*/5 * * * *";

export function startBookingExpiryCron(
  service: DealLifecycleService,
  logger: Logger
): ScheduledTask {
  let running = false;

  const task = cron.schedule(BOOKING_EXPIRY_CRON_SCHEDULE, async () => {
    if (running) return; // fournée précédente encore en vol
    running = true;
    try {
      const expired = await service.expireDueBookings();
      if (expired > 0) {
        logger.info({ expired }, "Expired overdue booking requests (24h window)");
      }
    } catch (err) {
      logger.error({ err }, "Booking expiry cron failed");
    } finally {
      running = false;
    }
  });

  logger.info({ schedule: BOOKING_EXPIRY_CRON_SCHEDULE }, "Booking expiry cron started");
  return task;
}
