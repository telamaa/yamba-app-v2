import { makeConversationRetentionService } from "../../apps/message-service/src/services/conversation-retention.service";
(async () => {
  console.log("purge :", JSON.stringify(await makeConversationRetentionService().purgeOnce(process.argv[2] ? new Date(process.argv[2]) : undefined)));
  process.exit(0);
})();
