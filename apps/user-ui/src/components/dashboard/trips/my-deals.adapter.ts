/**
 * my-deals.adapter.ts — CarrierBookingView (API) → CarrierDealItem / CarrierTripItem (vue)
 * =========================================================================================
 * Frontière unique entre GET /me/deals + GET /trips/my et le view-model
 * du module « Mes trajets » (types du mock, conservés — A44/A37).
 *
 * Dégradations assumées (jamais inventées) :
 * - hasRated : la notation n'existe pas (B5) → true, l'action « Noter »
 *   n'est pas dérivée ;
 * - pickupMeetingAt : aucun RDV dans le snapshot → absent (la ligne
 *   « prise en charge » n'affiche pas d'heure) ;
 * - recipientFirstName : révélé après la prise en charge seulement (É4) ;
 * - CarrierTripItem : capacité/vues à 0 (non utilisés par les lignes réelles).
 */

import type { CarrierBookingViewDto } from "@/components/carrier/deal/deal.adapter";
import type { TripListItem } from "@/components/trips/list/my-trips.config";
import { isTripPastDeparture } from "@/components/trips/list/my-trips.config";
import type { CarrierDealItem, CarrierTripItem, CarrierTrackingStep } from "./trips.types";

export function toCarrierDealItem(view: CarrierBookingViewDto): CarrierDealItem {
  const last = view.trackingEvents[view.trackingEvents.length - 1];
  return {
    id: view.id,
    status: view.status,
    shipper: {
      firstName: view.shipper.firstName ?? "",
      lastInitial: view.shipper.lastInitial,
    },
    recipientFirstName: view.pickedUpAt ? view.recipient.firstName : undefined,
    category: view.parcel.category,
    weightKg: view.pricing.weightKg,
    netEarningsEur: view.pricing.transportCents / 100,
    expiresAt: view.expiresAt,
    pickupLocationName: view.pickupPlace?.details ?? undefined,
    lastTrackingStep: last ? (last.step as CarrierTrackingStep) : undefined,
    deliveredAt: view.deliveredAt ?? undefined,
    payoutAt: view.payoutDueAt ?? undefined,
    hasRated: view.rating ? !view.rating.canRate : true, // B5 : « à noter » tant que le serveur le permet
    // B4-PR3 — l'état du versement porté par la ligne (A77).
    payoutStatus: view.payoutStatus ?? undefined,
    payoutSentAt: view.payoutSentAt ?? undefined,
    payoutBlocker: view.payoutBlocker ?? undefined,
    disputeTicket: view.disputeTicket ?? undefined,
    payoutAmountCents: view.payoutAmountCents ?? undefined,
    retentionDisposition: view.retentionDisposition ?? undefined,
  };
}

/** Deals groupés par trajet (Map tripId → deals, ordre serveur = plus récents d'abord). */
export function groupDealsByTrip(views: CarrierBookingViewDto[]): Map<string, CarrierDealItem[]> {
  const map = new Map<string, CarrierDealItem[]>();
  for (const view of views) {
    const list = map.get(view.tripId) ?? [];
    list.push(toCarrierDealItem(view));
    map.set(view.tripId, list);
  }
  return map;
}

function tripDepartureIso(trip: TripListItem): string {
  const date = trip.departureDateLocal ?? "";
  const time = trip.departureTimeLocal ?? "00:00";
  return date ? `${date}T${time.length === 5 ? time + ":00" : time}` : new Date(0).toISOString();
}

/** Le strict nécessaire de CarrierTripItem pour deriveCarrierActions et les lignes. */
export function toCarrierTripItem(trip: TripListItem, deals: CarrierDealItem[]): CarrierTripItem {
  const status: CarrierTripItem["status"] =
    trip.status === "CANCELLED"
      ? "CANCELLED"
      : trip.status === "COMPLETED"
        ? "COMPLETED"
        : isTripPastDeparture(trip.departureDateLocal)
          ? "DEPARTED"
          : "PUBLISHED";
  return {
    id: trip.id,
    status,
    originCity: trip.originCity ?? trip.originLabel ?? "—",
    destinationCity: trip.destinationCity ?? trip.destinationLabel ?? "—",
    departureAt: tripDepartureIso(trip),
    isDirect: true,
    capacityKg: 0,
    remainingKg: 0,
    viewsCount: 0,
    publishedAt: trip.publishedAt ?? trip.createdAt,
    deals,
  };
}

export const ACTIVE_DEAL_STATUSES = ["PENDING", "ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"] as const;

export function countPending(deals: CarrierDealItem[]): number {
  return deals.filter((d) => d.status === "PENDING").length;
}
