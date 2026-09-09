/** Force un passage d'expire-bookings (méthode A). */
import { dealLifecycleService } from "../../apps/deal-service/src/routes/deal.routes";
(async () => {
  const n = await dealLifecycleService.expireDueBookings(50);
  console.log("expirées :", n);
  process.exit(0);
})();
