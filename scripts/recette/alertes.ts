/** Évalue les alertes de seuil, et/ou notifie (méthode A). */
import redis from "../../packages/libs/redis";
import { opsAlertsService } from "../../apps/deal-service/src/routes/deal.routes";
(async () => {
  const mode = process.argv[2] ?? "evaluate";
  const reponse: any = await opsAlertsService.evaluate();
  const alertes: any[] = reponse.alerts;
  console.log(`${alertes.length} alerte(s) — seuils :`, JSON.stringify(reponse.thresholds));
  for (const a of alertes) console.log(`  ${String(a.severity).padEnd(11)} ${String(a.rule).padEnd(24)} ${a.detail ?? ""}`);
  if (mode === "notify") {
    const n = await opsAlertsService.notifyNewAlerts(redis);
    console.log("emails envoyés :", n);
  }
  process.exit(0);
})();
