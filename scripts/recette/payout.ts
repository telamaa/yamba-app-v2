/** Force les trois passes de payout-bookings, ou une seule. */
import { dealSettlementService } from "../../apps/deal-service/src/routes/deal.routes";
(async () => {
  const passe = process.argv[2] ?? "toutes";
  if (passe === "toutes" || passe === "due") console.log("autoCompleteDue      →", await dealSettlementService.autoCompleteDue(50));
  if (passe === "toutes" || passe === "retry") console.log("retryFailedPayouts   →", await dealSettlementService.retryFailedPayouts(50));
  if (passe === "toutes" || passe === "reminder") console.log("sendVerificationReminders →", await dealSettlementService.sendVerificationReminders(50));
  process.exit(0);
})();
