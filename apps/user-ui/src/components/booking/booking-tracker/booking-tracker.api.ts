/**
 * booking-tracker.api.ts
 * ======================
 * Wrapper côté client pour les appels backend liés au Booking côté Sender.
 * Mock pour l'instant — à brancher sur booking-service via le gateway.
 *
 * Astuce mock : un bookingId contenant "picked" renvoie le statut PICKED_UP
 * (code révélé). Ex : /fr/bookings/picked123
 */

import { MAX_CODE_REGENERATIONS, type Booking } from "./booking-tracker.types";
import {
  mockBookingAccepted,
  mockBookingDelivered,
  mockBookingInTransit,
  mockBookingPickedUp
} from "./booking-tracker.state";

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export async function getBooking(bookingId: string): Promise<Booking> {
  await sleep(MOCK_DELAY_MS);
  const base = bookingId.includes("delivered")
    ? mockBookingDelivered
    : bookingId.includes("transit")
      ? mockBookingInTransit
      : bookingId.includes("picked")
        ? mockBookingPickedUp
        : mockBookingAccepted;
  return { ...base, id: bookingId || base.id };
}

/**
 * Régénère un nouveau code livraison (max MAX_CODE_REGENERATIONS).
 * Seul l'Expéditeur peut le faire — le Voyageur ne voit jamais le code.
 */
export async function regenerateDeliveryCode(
  bookingId: string,
  currentRegeneratedCount: number
): Promise<{ bookingId: string; newCode: string; regeneratedCount: number }> {
  await sleep(MOCK_DELAY_MS);
  if (currentRegeneratedCount >= MAX_CODE_REGENERATIONS) {
    throw new Error("MAX_REGENERATIONS_REACHED");
  }
  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  // eslint-disable-next-line no-console
  console.info("[booking] regenerateDeliveryCode mock:", { bookingId, newCode });
  return {
    bookingId,
    newCode,
    regeneratedCount: currentRegeneratedCount + 1,
  };
}

// ============================================================
// Période de vérification — feat/verification-period
// ============================================================

/**
 * Confirmation anticipée du Sender ("tout va bien") : libère le paiement
 * immédiatement. Backend futur : Deal → COMPLETED, transfers.create()
 * Stripe vers le Voyageur, notification "Versement effectué".
 * Action DÉFINITIVE : plus de signalement possible ensuite.
 */
export async function confirmDeliveryEarly(
  bookingId: string
): Promise<{ bookingId: string; confirmedAt: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[booking] confirmDeliveryEarly mock:", bookingId);
  return { bookingId, confirmedAt: new Date().toISOString() };
}


// ============================================================
// Signalement de litige — feat/dispute-form
// ============================================================

/**
 * Envoie un signalement de litige.
 * Backend futur : Deal → DISPUTED, payout gelé, ticket support ouvert,
 * notification interne équipe Yamba + accusé de réception au Sender.
 */
export async function submitDispute(
  bookingId: string,
  payload: import("./booking-tracker.types").SubmitDisputePayload
): Promise<{ bookingId: string; ticketNumber: string; submittedAt: string }> {
  await sleep(MOCK_DELAY_MS);
  if (!payload.pledgeAccepted) {
    throw new Error("PLEDGE_REQUIRED");
  }
  if (payload.description.trim().length < 50) {
    throw new Error("DESCRIPTION_TOO_SHORT");
  }
  const ticketNumber =
    "YAM-" + Math.floor(1000 + Math.random() * 9000).toString();
  // eslint-disable-next-line no-console
  console.info("[booking] submitDispute mock:", { bookingId, payload, ticketNumber });
  return { bookingId, ticketNumber, submittedAt: new Date().toISOString() };
}
