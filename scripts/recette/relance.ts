import { makeUnreadReminderService } from "../../apps/message-service/src/services/unread-reminder.service";
(async () => {
  const r = await makeUnreadReminderService().runOnce(process.argv[2] ? new Date(process.argv[2]) : undefined);
  console.log("relances :", JSON.stringify(r));
  process.exit(0);
})();
