/**
 * shipments.adapter.ts — ShipperBookingView (API) → ShipmentListItem
 * ===================================================================
 * L'adaptateur est la SEULE frontière entre le contrat backend (OAS
 * deal-service, PR3) et le DTO de liste du front (shipments.types).
 * Fonction PURE : testable, et le reste du module ne voit jamais la
 * forme backend.
 *
 * Champs volontairement laissés undefined (documenté, pas oublié) :
 * - arrivalEtaAt : le backend ne pré-calcule pas encore l'ETA
 *   (durée de vol absente du snapshot) — le badge transit reste muet ;
 * - pickupMeetingAt / pickupLocationName : le RDV pickup naît en B2
 *   (BookingPickupInfo = confirmedAt/photoUrls/notes uniquement) ;
 * - hasRated / ratedStars : la notation naît en B5 ;
 * - refunded : le remboursement RÉEL est un fait Stripe (B2) — on
 *   n'affirme jamais un remboursement qu'aucun système n'a émis.
 */
import type {
  ShipmentListItem,
  ShipmentTrackingStep,
} from "./shipments.types";

/* ── Forme backend (whitelist de LECTURE — seuls les champs lus) ── */

type TrackingEventDto = {
  step: ShipmentTrackingStep;
  confirmedAt: string;
};

export type ShipperBookingViewDto = {
  id: string;
  status: ShipmentListItem["status"];
  trip: {
    originCity: string;
    destinationCity: string;
  };
  pricing: {
    weightKg: number;
  };
  parcel: {
    category: ShipmentListItem["category"];
  };
  recipient: {
    firstName: string;
  };
  carrier: {
    firstName: string;
    lastInitial: string;
  };
  requestedAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  payoutDueAt?: string | null;
  completedAt?: string | null;
  disputeTicket?: string | null;
  trackingEvents: TrackingEventDto[];
};

/** null backend → undefined front (les optionnels du DTO liste). */
function orUndef<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function toShipmentListItem(
  view: ShipperBookingViewDto
): ShipmentListItem {
  const lastTracking = view.trackingEvents.length
    ? view.trackingEvents[view.trackingEvents.length - 1]
    : undefined;

  return {
    id: view.id,
    status: view.status,
    originCity: view.trip.originCity,
    destinationCity: view.trip.destinationCity,
    category: view.parcel.category,
    weightKg: view.pricing.weightKg,
    carrier: {
      firstName: view.carrier.firstName,
      lastInitial: view.carrier.lastInitial,
    },
    recipientFirstName: view.recipient.firstName,
    requestedAt: view.requestedAt,
    acceptedAt: orUndef(view.acceptedAt),
    pickedUpAt: orUndef(view.pickedUpAt),
    deliveredAt: orUndef(view.deliveredAt),
    completedAt: orUndef(view.completedAt),
    expiresAt: view.expiresAt,
    payoutAt: orUndef(view.payoutDueAt),
    hasTrackingEvents: view.trackingEvents.length > 0,
    lastTrackingStep: lastTracking?.step,
    disputeTicket: orUndef(view.disputeTicket),
  };
}

export function toShipmentListItems(
  views: ShipperBookingViewDto[]
): ShipmentListItem[] {
  return views.map(toShipmentListItem);
}
