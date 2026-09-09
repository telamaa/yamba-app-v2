/** Force un passage de complete-trips (méthode A + horloge injectée). */
import { runCompleteTripsOnce } from "../../apps/trip-service/src/cron/complete-trips.cron";
(async () => {
  const arg = process.argv[2];
  console.log(await runCompleteTripsOnce(arg ? new Date(arg) : undefined));
  process.exit(0);
})();
