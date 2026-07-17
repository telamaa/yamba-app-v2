/**
 * Onboarding Email Service
 * ========================
 * Handles sending onboarding-related emails:
 * - Completion email (after onboarding finalized)
 * - Reminder sequence (3 emails: 24h → 72h → 7 days)
 *
 * 📁 Place in: apps/auth-service/src/services/onboarding-email.service.ts
 */

import { sendEmail } from "../utils/sendMail";
import prisma from "@packages/libs/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ─── Reminder schedule config ────────────────────────────────────
export const REMINDER_SCHEDULE = [
  { step: 1, delayHours: 24, subject: "Plus qu'une étape pour devenir Tripper !" },
  { step: 2, delayHours: 72, subject: "Ton profil Tripper t'attend…" },
  { step: 3, delayHours: 168, subject: "Dernière chance de finaliser ton profil" }, // 7 days
] as const;

export const MAX_REMINDERS = REMINDER_SCHEDULE.length;

// ─── Send completion email ───────────────────────────────────────
export async function sendOnboardingCompleteEmail(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        carrierPage: {
          include: { primaryAddress: true },
        },
      },
    });

    if (!user || !user.carrierPage) {
      console.error(`[onboarding-email] User or carrierPage not found for ${userId}`);
      return;
    }

    const { carrierPage } = user;
    const city =
      carrierPage.primaryAddress?.city ||
      carrierPage.primaryAddress?.formattedAddress ||
      "Non renseignée";

    const stripeReady = !!(
      carrierPage.stripeAccountId &&
      carrierPage.stripeOnboardingComplete &&
      carrierPage.stripeChargesEnabled
    );

    await sendEmail(
      user.email,
      "🎉 Ton profil Tripper est actif !",
      "carrier-onboarding-complete",
      {
        name: carrierPage.name || "Tripper",
        city,
        stripeReady,
        appUrl: APP_URL,
      }
    );

    console.log(`[onboarding-email] Completion email sent to ${user.email}`);
  } catch (error) {
    console.error(`[onboarding-email] Failed to send completion email:`, error);
  }
}

// ─── Send reminder email ─────────────────────────────────────────
export async function sendOnboardingReminderEmail(
  userId: string,
  reminderStep: number
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { carrierPage: true },
    });

    if (!user || !user.carrierPage) return;

    // Don't send if onboarding is already complete
    if (user.carrierStatus === "ACTIVE") return;

    const schedule = REMINDER_SCHEDULE[reminderStep - 1];
    if (!schedule) return;

    await sendEmail(
      user.email,
      schedule.subject,
      "carrier-onboarding-reminder",
      {
        name: user.carrierPage.name || "Tripper",
        step: schedule.step,
        currentStep: user.carrierPage.onboardingStep,
        appUrl: APP_URL,
      }
    );

    // Update reminder tracking fields
    await prisma.carrierPage.update({
      where: { userId },
      data: {
        lastReminderSentAt: new Date(),
        reminderCount: reminderStep,
      },
    });

    console.log(
      `[onboarding-email] Reminder ${reminderStep}/3 sent to ${user.email}`
    );
  } catch (error) {
    console.error(
      `[onboarding-email] Failed to send reminder ${reminderStep}:`,
      error
    );
  }
}
