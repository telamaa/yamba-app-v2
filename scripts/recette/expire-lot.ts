import { dealLifecycleService } from "../../apps/deal-service/src/routes/deal.routes";
(async () => {
  const taille = Number(process.argv[2] ?? 50);
  console.log(`fournée de ${taille} →`, await dealLifecycleService.expireDueBookings(taille), "expirée(s)");
  process.exit(0);
})();
