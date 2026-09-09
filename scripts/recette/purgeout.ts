import { purgePublishedOutbox } from "../../apps/deal-service/src/cron/outbox-retention.cron";
(async () => {
  const type = process.argv[2] ?? "booking";
  console.log(`purge ${type} →`, await purgePublishedOutbox(type as never, process.argv[3] ? new Date(process.argv[3]) : undefined), "supprimé(s)");
  process.exit(0);
})();
