/** onboarding-reminder.rules.spec.ts — le rappel d'onboarding, enfin branché (A148). */
import { ONBOARDING_REMINDER_MAX_AGE_DAYS, nextReminderStep, type OnboardingCandidate } from "./onboarding-reminder.rules";

const SCHEDULE = [
  { step: 1, delayHours: 24 },
  { step: 2, delayHours: 72 },
  { step: 3, delayHours: 168 },
] as const;
const NOW = new Date("2026-09-06T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const base: OnboardingCandidate = {
  carrierStatus: "ONBOARDING",
  isDeleted: false,
  emailSuppressedAt: null,
  page: { createdAt: hoursAgo(30), reminderCount: 0, lastReminderSentAt: null },
};
const step = (c: Partial<OnboardingCandidate>, now = NOW) => nextReminderStep({ ...base, ...c }, SCHEDULE, now);

describe("nextReminderStep (A148)", () => {
  it("le premier rappel part après 24 h, pas avant", () => {
    expect(step({})).toBe(1);
    expect(step({ page: { createdAt: hoursAgo(20), reminderCount: 0, lastReminderSentAt: null } })).toBeNull();
  });
  it("les rappels s'enchaînent dans l'ordre et s'arrêtent après le troisième", () => {
    expect(step({ page: { createdAt: hoursAgo(80), reminderCount: 1, lastReminderSentAt: hoursAgo(50) } })).toBe(2);
    expect(step({ page: { createdAt: hoursAgo(200), reminderCount: 2, lastReminderSentAt: hoursAgo(50) } })).toBe(3);
    expect(step({ page: { createdAt: hoursAgo(400), reminderCount: 3, lastReminderSentAt: hoursAgo(50) } })).toBeNull();
  });
  it("jamais deux rappels à moins de 12 h", () => {
    expect(step({ page: { createdAt: hoursAgo(80), reminderCount: 1, lastReminderSentAt: hoursAgo(5) } })).toBeNull();
    expect(step({ page: { createdAt: hoursAgo(80), reminderCount: 1, lastReminderSentAt: hoursAgo(13) } })).toBe(2);
  });
  it("jamais d'email à un compte effacé, à une adresse en suppression, ou à un Voyageur déjà actif (D35)", () => {
    expect(step({ isDeleted: true })).toBeNull();
    expect(step({ emailSuppressedAt: new Date("2026-09-01T00:00:00.000Z") })).toBeNull();
    expect(step({ carrierStatus: "ACTIVE" })).toBeNull();
    expect(step({ page: null })).toBeNull();
  });
  it("un compte abandonné depuis plus de 30 jours n'est plus réveillé", () => {
    const old = { createdAt: hoursAgo(ONBOARDING_REMINDER_MAX_AGE_DAYS * 24 + 5), reminderCount: 0, lastReminderSentAt: null };
    expect(step({ page: old })).toBeNull();
    const almost = { createdAt: hoursAgo(ONBOARDING_REMINDER_MAX_AGE_DAYS * 24 - 5), reminderCount: 0, lastReminderSentAt: null };
    expect(step({ page: almost })).toBe(1);
  });
});
