/**
 * onboarding-reminder.rules.ts — quel rappel d'onboarding envoyer, et à qui (A148)
 * =================================================================================
 * Le cron existait depuis l'origine mais n'était démarré nulle part : aucun rappel
 * n'est jamais parti. En le branchant, deux garde-fous manquaient :
 *  - le résolveur de destinataire ne sautait ni `isDeleted` ni `emailSuppressedAt`
 *    (règle générale des emails, D35) ;
 *  - rien ne bornait l'âge : brancher le cron aurait réveillé des comptes
 *    abandonnés depuis des mois avec un « dernière chance » incongru.
 * La règle est pure : le cron ne fait que charger, filtrer et envoyer.
 */
export const ONBOARDING_REMINDER_MAX_AGE_DAYS = 30;
export const ONBOARDING_REMINDER_MIN_INTERVAL_HOURS = 12;

export type ReminderStep = { step: number; delayHours: number };
export type OnboardingCandidate = {
  carrierStatus: string;
  isDeleted: boolean;
  emailSuppressedAt: Date | null;
  page: { createdAt: Date; reminderCount: number; lastReminderSentAt: Date | null } | null;
};

const HOUR = 3_600_000;

/** Le rappel à envoyer maintenant (1, 2 ou 3), ou null. */
export function nextReminderStep(
  candidate: OnboardingCandidate,
  schedule: readonly ReminderStep[],
  now: Date,
  maxAgeDays: number = ONBOARDING_REMINDER_MAX_AGE_DAYS
): number | null {
  const { page } = candidate;
  if (!page) return null;
  if (candidate.isDeleted || candidate.emailSuppressedAt) return null; // D35 — jamais d'email à une adresse effacée ou en suppression
  if (candidate.carrierStatus !== "ONBOARDING") return null;
  if (page.reminderCount >= schedule.length) return null;
  const next = schedule[page.reminderCount];
  if (!next) return null;
  const ageHours = (now.getTime() - page.createdAt.getTime()) / HOUR;
  if (ageHours < next.delayHours) return null;
  if (ageHours > maxAgeDays * 24) return null; // trop vieux : on ne réveille pas un compte abandonné
  if (page.lastReminderSentAt && (now.getTime() - page.lastReminderSentAt.getTime()) / HOUR < ONBOARDING_REMINDER_MIN_INTERVAL_HOURS) return null;
  return next.step;
}
