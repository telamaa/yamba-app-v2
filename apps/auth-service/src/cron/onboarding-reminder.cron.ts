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
 * 🔌 Integration: import and call `startOnboardingReminderCron()` in your
 *    server entry point (e.g., index.ts / app.ts)
 */

import cron from "node-cron";
import prisma from "@repo/prisma/client"; // adjust to your setup
import {
  sendOnboardingReminderEmail,
  REMINDER_SCHEDULE,
  MAX_REMINDERS,
} from "../services/onboarding-email.service";

// ─── Helper: hours since a date ──────────────────────────────────
function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

// ─── Main cron logic ─────────────────────────────────────────────
async function processOnboardingReminders() {
  try {
    // Find all users stuck in ONBOARDING who haven't received all 3 reminders
    const stuckUsers = await prisma.user.findMany({
      where: {
        carrierStatus: "ONBOARDING",
        carrierPage: {
          reminderCount: { lt: MAX_REMINDERS },
        },
      },
      include: {
        carrierPage: true,
      },
    });

    if (stuckUsers.length === 0) return;

    console.log(
      `[reminder-cron] Processing ${stuckUsers.length} stuck onboarding user(s)`
    );

    for (const user of stuckUsers) {
      const carrierPage = user.carrierPage;
      if (!carrierPage) continue;

      const currentReminderCount = carrierPage.reminderCount || 0;
      const nextReminderIndex = currentReminderCount; // 0-based
      const nextSchedule = REMINDER_SCHEDULE[nextReminderIndex];

      if (!nextSchedule) continue;

      // Calculate hours since the carrierPage was created (= onboarding started)
      const elapsed = hoursSince(carrierPage.createdAt);

      // Only send if enough time has passed for this reminder step
      if (elapsed >= nextSchedule.delayHours) {
        // Extra guard: don't send if last reminder was sent less than 12h ago
        // (prevents double-sends in edge cases)
        if (
          carrierPage.lastReminderSentAt &&
          hoursSince(carrierPage.lastReminderSentAt) < 12
        ) {
          continue;
        }

        await sendOnboardingReminderEmail(user.id, nextSchedule.step);
      }
    }
  } catch (error) {
    console.error("[reminder-cron] Error processing reminders:", error);
  }
}

// ─── Start cron ──────────────────────────────────────────────────
export function startOnboardingReminderCron() {
  // Run every hour at minute :00
  cron.schedule("0 * * * *", () => {
    console.log("[reminder-cron] Running onboarding reminder check...");
    processOnboardingReminders();
  });

  console.log("[reminder-cron] Onboarding reminder cron started (every hour)");
}

// ─── Manual trigger (useful for testing) ─────────────────────────
export { processOnboardingReminders };
