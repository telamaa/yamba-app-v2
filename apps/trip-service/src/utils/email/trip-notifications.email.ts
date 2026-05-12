import type { Trip } from "@prisma/client";
import { sendEmail } from "./send-email";

const APP_URL = process.env.USER_APP_URL ?? "http://localhost:3000";
const DEFAULT_LOCALE: "fr" | "en" = "fr"; // Plus tard : depuis user.preferredLocale

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

function formatDate(date: Date | null, locale: "fr" | "en"): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Envoie l'email "trip published" avec contexte enrichi (follow / saved route / les 2).
 */
export async function sendTripPublishedEmail(
  payload: TripPublishedEmailPayload
): Promise<void> {
  const { recipient, tripper, trip } = payload;
  const locale = DEFAULT_LOCALE;
  const lastInitial = tripper.lastName.charAt(0).toUpperCase();

  // Sujet adapté au contexte
  let subject: string;
  if (recipient.followsTripper && recipient.matchingSavedRoute) {
    subject =
      locale === "fr"
        ? `${tripper.firstName} ${lastInitial}. a publié un trajet ${trip.originCity} → ${trip.destinationCity}`
        : `${tripper.firstName} ${lastInitial}. published a trip ${trip.originCity} → ${trip.destinationCity}`;
  } else if (recipient.followsTripper) {
    subject =
      locale === "fr"
        ? `${tripper.firstName} ${lastInitial}. vient de publier un nouveau trajet`
        : `${tripper.firstName} ${lastInitial}. just published a new trip`;
  } else {
    subject =
      locale === "fr"
        ? `Nouveau trajet ${trip.originCity} → ${trip.destinationCity}`
        : `New trip ${trip.originCity} → ${trip.destinationCity}`;
  }

  const data = {
    locale,
    subject,
    recipient: {
      firstName: recipient.firstName,
      followsTripper: recipient.followsTripper,
      matchingSavedRoute: recipient.matchingSavedRoute,
    },
    tripper: {
      firstName: tripper.firstName,
      lastInitial,
    },
    trip,
    formattedDepartureDate: formatDate(trip.departureAt, locale),
    tripUrl: `${APP_URL}/${locale}/trips/${trip.id}`,
    tripperUrl: tripper.publicSlug
      ? `${APP_URL}/${locale}/u/${tripper.publicSlug}`
      : null,
    manageAlertsUrl: `${APP_URL}/${locale}/dashboard/saved-routes`,
  };

  await sendEmail(
    recipient.email,
    subject,
    "trip-notifications/trip-published",
    data
  );
}

// ─────────────────────────────────────────────────────────
// Helpers pour les emails de cycle de vie des SavedRoute
// (utilisés en Phase 7 par le cron d'expiration)
// ─────────────────────────────────────────────────────────

/**
 * Email de relance envoyé 7 jours avant l'expiration d'une SavedRoute.
 * Propose à l'utilisateur de prolonger l'alerte.
 */
export async function sendSavedRouteExpiryWarningEmail(payload: {
  recipient: { email: string; firstName: string };
  savedRoute: { id: string; originCity: string; destinationCity: string };
}): Promise<void> {
  const locale = DEFAULT_LOCALE;
  const subject =
    locale === "fr"
      ? `Votre alerte ${payload.savedRoute.originCity} → ${payload.savedRoute.destinationCity} expire bientôt`
      : `Your alert ${payload.savedRoute.originCity} → ${payload.savedRoute.destinationCity} expires soon`;

  await sendEmail(
    payload.recipient.email,
    subject,
    "trip-notifications/saved-route-expiry-warning",
    {
      locale,
      subject,
      recipient: payload.recipient,
      savedRoute: payload.savedRoute,
      extendUrl: `${APP_URL}/${locale}/dashboard/saved-routes?extend=${payload.savedRoute.id}`,
      manageAlertsUrl: `${APP_URL}/${locale}/dashboard/saved-routes`,
    }
  );
}

/**
 * Email de notification d'expiration définitive.
 * Envoyé au moment où la SavedRoute est désactivée par le cron.
 */
export async function sendSavedRouteExpiredEmail(payload: {
  recipient: { email: string; firstName: string };
  savedRoute: { originCity: string; destinationCity: string };
}): Promise<void> {
  const locale = DEFAULT_LOCALE;
  const subject =
    locale === "fr"
      ? `Votre alerte ${payload.savedRoute.originCity} → ${payload.savedRoute.destinationCity} a expiré`
      : `Your alert ${payload.savedRoute.originCity} → ${payload.savedRoute.destinationCity} has expired`;

  await sendEmail(
    payload.recipient.email,
    subject,
    "trip-notifications/saved-route-expired",
    {
      locale,
      subject,
      recipient: payload.recipient,
      savedRoute: payload.savedRoute,
      createAlertUrl: `${APP_URL}/${locale}/dashboard/saved-routes`,
    }
  );
}
