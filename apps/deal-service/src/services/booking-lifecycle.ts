/**
 * booking-lifecycle.ts — logique PURE des transitions accept/decline/cancel/expire (B2-PR2)
 * =========================================================================================
 * Emplacement : apps/deal-service/src/services/booking-lifecycle.ts
 *
 * Tout ce qui se teste sans base ni fournisseur de paiement :
 *   - `BookingLifecycleError`         : 409 métier avec code (le front traduit)
 *   - `computeCancellationRefundCents`: barème ANN-01 au moment T (D39)
 *   - `kgReservedBySnapshot`          : les kg à restituer (CAP-02) — miroir
 *                                       de kgToReserve côté création
 *   - `baseEventPayload`              : socle commun des payloads outbox,
 *                                       construit depuis les SNAPSHOTS figés
 *                                       (D17 : jamais relus du Trip)
 *
 * Le service d'écriture (deal-lifecycle.service.ts) orchestre : machine →
 * argent (PaymentProvider) → transaction Mongo conditionnelle + outbox.
 */

import { AppError } from "@packages/error-handler";
import type { BookingActor, BookingLifecycleErrorCode } from "@packages/api-contracts";

/* ══ Erreur métier 409 avec code ══════════════════════════════ */

export class BookingLifecycleError extends AppError {
  readonly code: BookingLifecycleErrorCode;
  constructor(code: BookingLifecycleErrorCode, message: string, extra?: Record<string, unknown>) {
    // details.type = "booking" : exposé même en production (liste « safe »
    // de l'error-middleware) — le front a besoin du code pour traduire.
    super(message, 409, true, { type: "booking", code, ...(extra ?? {}) });
    this.code = code;
  }
}

/* ══ Paramètres serveur ANN-01 (§13 — gravés D39) ═════════════ */

export const CANCEL_FULL_REFUND_UNTIL_HOURS = 48;
export const CANCEL_LATE_RETENTION_PCT = 50;

/* ══ Vue minimale du Booking nécessaire ici ═══════════════════ */

export type BookingSnapshotsForLifecycle = {
  trip: {
    originCity: string;
    originCountryCode: string | null;
    destinationCity: string;
    destinationCountryCode: string | null;
    departureAt: Date;
  };
  pricing: {
    weightKg: number;
    transportCents: number;
    totalShipperCents: number;
    currencyCode: string;
  };
  parcel: {
    category: string;
    categoryFamily: string | null;
  };
};

/* ══ Barème ANN-01 (D39) ══════════════════════════════════════ */

/**
 * Montant rendu à l'Expéditeur pour une annulation APRÈS acceptation :
 * 100 % jusqu'à J-2 du départ, sinon retenue CANCEL_LATE_RETENTION_PCT
 * (destinée au Voyageur — versée avec l'infrastructure payout, B4).
 * Départ passé : même barème « moins de 48 h » (le pickup n'a pas eu lieu,
 * sinon la machine aurait déjà interdit l'annulation).
 */
/**
 * Compensation du Voyageur sur une annulation tardive (D50, A79) :
 * la retenue au prorata de sa part nette — `round(retenue × net / total)`,
 * arrondi au centime, reste à Yamba. 0 si rien n'est retenu.
 */
export function computeLateCancellationCompensationCents(args: {
  retentionCents: number;
  transportCents: number;
  totalShipperCents: number;
}): number {
  const { retentionCents, transportCents, totalShipperCents } = args;
  if (retentionCents <= 0 || totalShipperCents <= 0) return 0;
  return Math.round((retentionCents * transportCents) / totalShipperCents);
}

export function computeCancellationRefundCents(args: {
  totalShipperCents: number;
  departureAt: Date;
  now: Date;
}): number {
  const { totalShipperCents, departureAt, now } = args;
  const hoursUntilDeparture = (departureAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntilDeparture >= CANCEL_FULL_REFUND_UNTIL_HOURS) return totalShipperCents;
  return Math.round((totalShipperCents * (100 - CANCEL_LATE_RETENTION_PCT)) / 100);
}

/* ══ Kg à restituer (CAP-02) ══════════════════════════════════ */

/**
 * Miroir de kgToReserve (création, D37) : le snapshot stocke dans
 * `pricing.weightKg` le poids déclaré (PARCEL) OU la franchise du bagage
 * (FLAT_BAG : buildBookingSnapshots y écrit capacityKgConsumed).
 */
export function kgReservedBySnapshot(pricing: { weightKg: number }): number {
  return pricing.weightKg;
}

/* ══ Socle des payloads outbox (verrou 3 : richesse) ══════════ */

export function baseEventPayload(
  booking: {
    id: string;
    tripId: string;
    shipperId: string;
    carrierId: string;
  } & BookingSnapshotsForLifecycle,
  actor: BookingActor
) {
  return {
    bookingId: booking.id,
    tripId: booking.tripId,
    shipperId: booking.shipperId,
    carrierId: booking.carrierId,
    corridor: {
      originCity: booking.trip.originCity,
      originCountryCode: booking.trip.originCountryCode,
      destinationCity: booking.trip.destinationCity,
      destinationCountryCode: booking.trip.destinationCountryCode,
    },
    category: booking.parcel.category,
    categoryFamily: booking.parcel.categoryFamily,
    weightKg: booking.pricing.weightKg,
    transportCents: booking.pricing.transportCents,
    totalShipperCents: booking.pricing.totalShipperCents,
    currencyCode: booking.pricing.currencyCode,
    actor,
  };
}
