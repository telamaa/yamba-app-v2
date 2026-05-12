import type { Trip } from "@prisma/client";

/**
 * Payload pour l'email "Un nouveau trajet correspond".
 */
export type TripPublishedEmailPayload = {
  recipient: {
    userId: string;
    email: string;
    firstName: string;
    // Pourquoi cette personne reçoit cet email
    followsTripper: boolean;
    matchingSavedRoute: {
      id: string;
      matchScore: number; // 100 = exact, 70 = nearby
      originCity: string;
      destinationCity: string;
    } | null;
  };
  tripper: {
    id: string;
    firstName: string;
    lastName: string;
    publicSlug: string | null;
  };
  trip: Trip;
};

/**
 * STUB — sera remplacé en Phase 4 par l'implémentation Nodemailer + EJS.
 *
 * Pour l'instant, log juste le payload dans la console pour permettre
 * de tester la logique de matching sans bloquer la phase.
 */
export async function sendTripPublishedEmail(
  payload: TripPublishedEmailPayload
): Promise<void> {
  const { recipient, tripper, trip } = payload;

  const reasons: string[] = [];
  if (recipient.followsTripper) reasons.push("follows tripper");
  if (recipient.matchingSavedRoute) {
    reasons.push(
      `saved route match (score ${recipient.matchingSavedRoute.matchScore})`
    );
  }

  console.log("[email STUB] Trip published notification:", {
    to: recipient.email,
    firstName: recipient.firstName,
    tripperName: `${tripper.firstName} ${tripper.lastName.charAt(0)}.`,
    tripperSlug: tripper.publicSlug,
    tripId: trip.id,
    route: `${trip.originCity} → ${trip.destinationCity}`,
    departureAt: trip.departureAt,
    reasons,
  });
}
