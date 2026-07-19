import prisma from "@packages/libs/prisma";
import {
  BOOKING_ACTIVE_STATUSES,
  BOOKING_COMPLETION_BLOCKING_STATUSES,
} from "@packages/api-contracts";

/**
 * booking-queries.ts — lectures Booking côté trip-service (PR3)
 * =============================================================
 * Emplacement : apps/trip-service/src/services/booking-queries.ts
 *
 * Remplace le STUB hasActiveBookings de trip-state-machine.ts.
 * La machine reste zéro-dépendance : ces requêtes vivent ici et leurs
 * résultats sont passés dans le contexte (ctx.hasActiveBookings /
 * ctx.hasBookingsInProgress) par les call sites (controller, cron).
 *
 * A19 — les ensembles de statuts sont importés de la source unique
 * (@packages/api-contracts), jamais recopiés.
 *
 * A20 — deux questions distinctes, deux réponses distinctes :
 *   - hasActiveBookings : bookings conservant les kg (CAP-02),
 *     DISPUTED INCLUS → bloque edit / unpublish.
 *   - hasBookingsInProgress : bookings bloquant la COMPLÉTION du trip,
 *     DISPUTED EXCLU (le voyage physique est fini ; le litige gèle le
 *     payout, pas la fin du voyage) → guard du cron complete-trips.
 */

/** Bookings "actifs" (kg réservés — CAP-02). Bloque edit/unpublish. */
export async function hasActiveBookings(tripId: string): Promise<boolean> {
  const count = await prisma.booking.count({
    where: {
      tripId,
      isDeleted: false,
      status: { in: [...BOOKING_ACTIVE_STATUSES] },
    },
  });
  return count > 0;
}

/** Bookings bloquant la complétion (A20 : actifs − DISPUTED). */
export async function hasBookingsInProgress(tripId: string): Promise<boolean> {
  const count = await prisma.booking.count({
    where: {
      tripId,
      isDeleted: false,
      status: { in: [...BOOKING_COMPLETION_BLOCKING_STATUSES] },
    },
  });
  return count > 0;
}
