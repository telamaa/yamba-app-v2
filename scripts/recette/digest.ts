import { dealSettlementService } from "../../apps/deal-service/src/routes/deal.routes";
import { sendOpsDigest } from "../../apps/deal-service/src/services/ops-notify.service";
(async () => {
  const d: any = await dealSettlementService.collectOpsDigest();
  console.log("récapitulatif :", JSON.stringify({ failed: d.failed?.length ?? 0, reversed: d.reversed?.length ?? 0, held: d.held?.length ?? 0 }));
  if (process.argv[2] === "envoi") console.log("envoyé :", await sendOpsDigest(d, new Date()));
  process.exit(0);
})();
