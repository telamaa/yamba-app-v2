import type { Trip } from "@prisma/client";
import { dispatchTripPublishedNotifications } from "./trip-notifications.service";

/**
 * Wrapper non-bloquant pour déclencher les notifications post-publication.
 *
 * Utilisation : appelé depuis les controllers (createTrip / updateTrip / publishTrip)
 * SANS `await` pour ne pas bloquer la réponse API.
 *
 * Toute erreur est catchée et loguée — la publication du trip reste un succès
 * du point de vue de l'utilisateur même si les notifications échouent.
 *
 * @param trip Le trip qui vient d'être publié
 */
export function triggerTripPublishedNotifications(trip: Trip): void {
  // setImmediate déconnecte l'exécution du cycle de réponse Express,
  // garantissant que la réponse part avant qu'on commence le dispatch.
  setImmediate(() => {
    dispatchTripPublishedNotifications(trip).catch((err) => {
      console.error(
        `[trip-notifications] Trigger failed for trip ${trip.id}:`,
        err
      );
    });
  });
}
