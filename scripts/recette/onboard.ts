import { processOnboardingReminders } from "../../apps/auth-service/src/cron/onboarding-reminder.cron";
(async () => {
  console.log("rappels :", JSON.stringify(await processOnboardingReminders(process.argv[2] ? new Date(process.argv[2]) : undefined)));
  process.exit(0);
})();
