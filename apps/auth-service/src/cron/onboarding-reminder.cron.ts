/**
 * Onboarding Reminder Cron Job
 * ============================
 * Runs every hour. Checks for users stuck in ONBOARDING status
 * and sends the appropriate reminder based on elapsed time.
 *
 * Sequence:
 *   Reminder 1 → 24h after carrierPage creation
 *   Reminder 2 → 72h after carrierPage creation
 *   Reminder 3 → 7 days after carrierPage creation (final)
 *
 * 📁 Place in: apps/auth-service/src/cron/onboarding-reminder.cron.ts
 * 📦 Requires: npm install node-cron (or use your existing scheduler)
 *
 * A148 — DÉMARRÉ depuis `apps/auth-service/src/main.ts` (il ne l'était nulle part :
 * aucun rappel n'est jamais parti). Coupable par `ONBOARDING_REMINDER_CRON_ENABLED=false`.
 * La sélection est une règle pure : `utils/onboarding-reminder.rules.ts`.
 */

import cron from "node-cron";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";

import {
  sendOnboardingReminderEmail,
  REMINDER_SCHEDULE,
  MAX_REMINDERS,
} from "../services/onboarding-email.service";
import { nextReminderStep } from "../utils/onboarding-reminder.rules"; // A148

// ─── Main cron logic ─────────────────────────────────────────────
async function processOnboardingReminders(now: Date = new Date()): Promise<{ sent: number }> {
  // A148 — le destinataire est filtré comme partout ailleurs (D35) : jamais un compte
  // effacé, jamais une adresse en liste de suppression après un rebond dur.
  const candidates = await prisma.user.findMany({
    where: {
      carrierStatus: "ONBOARDING",
      isDeleted: false,
      OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }],
      carrierPage: { reminderCount: { lt: MAX_REMINDERS } },
    } as never,
    include: { carrierPage: true },
    take: 200,
  });

  let sent = 0;
  for (const user of candidates) {
    const page = user.carrierPage;
    const step = nextReminderStep(
      {
        carrierStatus: user.carrierStatus,
        isDeleted: user.isDeleted,
        emailSuppressedAt: user.emailSuppressedAt ?? null,
        page: page ? { createdAt: page.createdAt, reminderCount: page.reminderCount ?? 0, lastReminderSentAt: page.lastReminderSentAt ?? null } : null,
      },
      REMINDER_SCHEDULE,
      now
    );
    if (step === null) continue;
    await sendOnboardingReminderEmail(user.id, step); // best effort : n'explose jamais
    sent += 1;
  }
  return { sent };
}

// ─── Start cron ──────────────────────────────────────────────────
export const ONBOARDING_REMINDER_SCHEDULE = "0 * * * *";

export function startOnboardingReminderCron() {
  let running = false; // garde de chevauchement, comme les autres crons
  const task = cron.schedule(ONBOARDING_REMINDER_SCHEDULE, () => {
    if (running) return;
    running = true;
    void withHeartbeat(
      redis,
      { service: "auth-service", name: "onboarding-reminder", schedule: ONBOARDING_REMINDER_SCHEDULE },
      () => processOnboardingReminders(),
      (r) => `${r.sent} rappel(s)`
    )
      .catch((err) => console.error("[reminder-cron] failed:", err))
      .finally(() => {
        running = false;
      });
  });
  return task;
}

// ─── Manual trigger (useful for testing) ─────────────────────────
export { processOnboardingReminders };
