import { dealRatingService } from "../../apps/deal-service/src/routes/deal.routes";
(async () => {
  const passe = process.argv[2] ?? "toutes";
  if (passe === "toutes" || passe === "relances") console.log("sendRatingReminders →", await dealRatingService.sendRatingReminders());
  if (passe === "toutes" || passe === "reveal") console.log("revealElapsed       →", await dealRatingService.revealElapsed());
  process.exit(0);
})();
