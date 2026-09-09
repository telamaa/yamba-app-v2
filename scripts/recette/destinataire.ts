import { makeRecipientRedactionService } from "../../apps/deal-service/src/services/recipient-redaction.service";
(async () => {
  console.log("effacement :", JSON.stringify(await makeRecipientRedactionService().runOnce(process.argv[2] ? new Date(process.argv[2]) : undefined)));
  process.exit(0);
})();
