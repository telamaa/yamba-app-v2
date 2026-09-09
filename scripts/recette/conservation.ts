import { makeRetentionService } from "../../apps/notification-service/src/cron/retention.cron";
(async () => {
  console.log("conservation :", JSON.stringify(await makeRetentionService().runOnce(process.argv[2] ? new Date(process.argv[2]) : undefined)));
  process.exit(0);
})();
