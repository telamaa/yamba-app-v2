/**
 * booking-tracker.api.ts
 * ======================
 * Wrapper côté client pour les appels backend liés au Booking côté Sender.
 * Mock pour l'instant — à brancher sur booking-service via le gateway.
 */

import type { Booking } from "./booking-tracker.types";
import { mockBookingAccepted } from "./booking-tracker.state";

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBooking(bookingId: string): Promise<Booking> {
  await sleep(MOCK_DELAY_MS);
  return { ...mockBookingAccepted, id: bookingId || mockBookingAccepted.id };
}

/**
 * Régénère un nouveau code livraison (max 5 régénérations).
 * Disponible uniquement quand deliveryCode.status === "AVAILABLE" ou plus.
 */
export async function regenerateDeliveryCode(
  bookingId: string
): Promise<{ bookingId: string; newCode: string; regeneratedCount: number }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[booking] regenerateDeliveryCode mock:", bookingId);
  return {
    bookingId,
    newCode: Math.floor(100000 + Math.random() * 900000).toString(),
    regeneratedCount: 1,
  };
}
