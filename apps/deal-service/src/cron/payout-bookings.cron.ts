/**
 * payout-bookings.cron.ts — versement J+4, rejeu des versements, rappel J+3 (B4, A66/A70)
 * =========================================================================================
 * Emplacement : apps/deal-service/src/cron/payout-bookings.cron.ts
 *
 * Toutes les 5 minutes, trois passes dans l'ordre :
 *   1. DELIVERED dont `payoutDueAt` est passé → COMPLETED (SYSTEM) + transfert (D49).
 *   2. COMPLETED dont le versement est FAILED (< 10 essais) → nouveau transfert.
 *   3. DELIVERED à ≤ 24 h de l'échéance, sans rappel → `booking.verification_reminder`.
 *
 * Même patron que expire-bookings.cron.ts : un run en vol saute le tick
 * suivant ; fournées de 50 ; horloge UTC (FUS-03). Désactivable :
 * BOOKING_PAYOUT_CRON_ENABLED=false (instances API pures).
 */

import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { DealSettlementService } from "../services/deal-settlement.service";

export const BOOKING_PAYOUT_CRON_SCHEDULE = "*/5 * * * *";

export async function runPayoutPasses(service: DealSettlementService, logger: Logger): Promise<void> {
  const completed = await service.autoCompleteDue();
  if (completed > 0) logger.info({ completed }, "Auto-completed deals past their verification window (D+4)");
  const retried = await service.retryFailedPayouts();
  if (retried > 0) logger.info({ sent: retried }, "Retried carrier payouts sent");
  const reminded = await service.sendVerificationReminders();
  if (reminded > 0) logger.info({ reminded }, "Verification reminders (D+3) emitted");
}

export function startBookingPayoutCron(service: DealSettlementService, logger: Logger): ScheduledTask {
  let running = false;

  const task = cron.schedule(BOOKING_PAYOUT_CRON_SCHEDULE, async () => {
    if (running) return; // fournée précédente encore en vol
    running = true;
    try {
      await runPayoutPasses(service, logger);
    } catch (err) {
      logger.error({ err }, "Booking payout cron failed");
    } finally {
      running = false;
    }
  });

  logger.info({ schedule: BOOKING_PAYOUT_CRON_SCHEDULE }, "Booking payout cron started");
  return task;
}
