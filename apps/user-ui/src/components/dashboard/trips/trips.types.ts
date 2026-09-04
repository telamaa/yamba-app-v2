import type { ParcelCategory } from "@/components/booking/booking.types";

/* ─────────────────────────── Statuts ─────────────────────────── */

export type CarrierTripStatus =
  | "PUBLISHED" // à venir, visible dans la recherche
  | "DEPARTED" // parti, en transit
  | "ARRIVED" // atterri, remises en cours
  | "COMPLETED" // tous les deals soldés
  | "CANCELLED";

export type CarrierDealStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type CarrierTrackingStep =
  | "AT_AIRPORT"
  | "FLIGHT_DEPARTED"
  | "FLIGHT_ARRIVED";

/* ─────────────────────────── DTOs liste ──────────────────────── */

/**
 * Deal imbriqué dans un trajet — vue Voyageur.
 * Contrat backend cible : GET /me/trips?include=deals
 */
export type CarrierDealItem = {
  id: string;
  status: CarrierDealStatus;

  shipper: { firstName: string; lastInitial: string };
  recipientFirstName?: string;

  category: ParcelCategory;
  weightKg: number;

  /** Net Voyageur (après commission + frais) */
  netEarningsEur: number;

  /** PENDING : fin de la fenêtre 24h (pré-calculé serveur) */
  expiresAt?: string;

  /** ACCEPTED : RDV pickup */
  pickupMeetingAt?: string;
  pickupLocationName?: string;

  /** PICKED_UP */
  lastTrackingStep?: CarrierTrackingStep;

  /** DELIVERED / COMPLETED */
  deliveredAt?: string;
  payoutAt?: string;
  hasRated?: boolean;
  /** B4-PR3 (A75/A77) — état réel du versement, servi. */
  payoutStatus?: "PENDING" | "SENT" | "FAILED" | "FROZEN" | "REVERSED";
  payoutSentAt?: string;
  payoutBlocker?: "ACCOUNT_NOT_READY" | "RETRYING";
  disputeTicket?: string;
  /** D50/A82 — compensation d'annulation tardive (CANCELLED). */
  payoutAmountCents?: number;
  retentionDisposition?: "CARRIER" | "SHIPPER" | "HELD_FOR_MEDIATION";
};

export type CarrierTripItem = {
  id: string;
  status: CarrierTripStatus;

  originCity: string;
  originDetail?: string;
  destinationCity: string;
  destinationDetail?: string;

  departureAt: string;
  arrivedAt?: string;
  durationHours?: number;
  isDirect: boolean;
  stopsCount?: number;

  capacityKg: number;
  remainingKg: number;

  viewsCount: number;
  publishedAt: string;

  deals: CarrierDealItem[];
};

/* ─────────────────── Actions dérivées (inbox) ────────────────── */

export type CarrierActionKind = "RESPOND" | "PICKUP" | "DELIVER" | "RATE";

export type CarrierAction = {
  kind: CarrierActionKind;
  dealId: string;
  tripId: string;
  href: string;
  /** Échéance affichée en badge (RESPOND : expiresAt, PICKUP : RDV) */
  deadlineAt?: string;
  deal: CarrierDealItem;
  trip: CarrierTripItem;
};

const ACTION_ORDER: Record<CarrierActionKind, number> = {
  RESPOND: 0,
  PICKUP: 1,
  DELIVER: 2,
  RATE: 3,
};

/**
 * Scanne les deals de tous les trajets et dérive la bande "À traiter".
 * Une seule "prochaine action" par deal (machine d'état, spec §2).
 * Tri : par type d'urgence, puis par échéance croissante.
 */
export function deriveCarrierActions(
  trips: CarrierTripItem[]
): CarrierAction[] {
  const actions: CarrierAction[] = [];

  for (const trip of trips) {
    for (const deal of trip.deals) {
      const base = { dealId: deal.id, tripId: trip.id, deal, trip };

      if (deal.status === "PENDING") {
        actions.push({
          ...base,
          kind: "RESPOND",
          href: "/carrier/deals/" + deal.id,
          deadlineAt: deal.expiresAt,
        });
      } else if (deal.status === "ACCEPTED") {
        actions.push({
          ...base,
          kind: "PICKUP",
          href: "/carrier/deals/" + deal.id + "/pickup",
          deadlineAt: deal.pickupMeetingAt,
        });
      } else if (
        deal.status === "PICKED_UP" &&
        deal.lastTrackingStep === "FLIGHT_ARRIVED"
      ) {
        actions.push({
          ...base,
          kind: "DELIVER",
          href: "/carrier/deals/" + deal.id + "/deliver",
        });
      } else if (deal.status === "COMPLETED" && !deal.hasRated) {
        actions.push({
          ...base,
          kind: "RATE",
          href: "/carrier/deals/" + deal.id + "/rate",
        });
      }
    }
  }

  return actions.sort((a, b) => {
    const orderDiff = ACTION_ORDER[a.kind] - ACTION_ORDER[b.kind];
    if (orderDiff !== 0) return orderDiff;
    const aDeadline = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
    const bDeadline = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
    return aDeadline - bDeadline;
  });
}

/* ─────────────────── Groupement des trajets ──────────────────── */

export type TripGroup = "upcoming" | "inProgress" | "history";

export function getTripGroup(trip: CarrierTripItem): TripGroup {
  switch (trip.status) {
    case "PUBLISHED":
      return "upcoming";
    case "DEPARTED":
    case "ARRIVED":
      return "inProgress";
    case "COMPLETED":
    case "CANCELLED":
      return "history";
  }
}

/**
 * Gains confirmés d'un trajet = somme des nets des deals engagés
 * (ACCEPTED → COMPLETED). Les PENDING ne comptent pas (spec paiement §3.2).
 */
export function getTripConfirmedEarnings(trip: CarrierTripItem): number {
  return trip.deals
    .filter(
      (d) =>
        d.status === "ACCEPTED" ||
        d.status === "PICKED_UP" ||
        d.status === "DELIVERED" ||
        d.status === "COMPLETED"
    )
    .reduce((sum, d) => sum + d.netEarningsEur, 0);
}

export function getTripPendingCount(trip: CarrierTripItem): number {
  return trip.deals.filter((d) => d.status === "PENDING").length;
}

export function getTripEngagedCount(trip: CarrierTripItem): number {
  return trip.deals.filter(
    (d) => d.status !== "PENDING" && d.status !== "DECLINED" &&
      d.status !== "EXPIRED" && d.status !== "CANCELLED"
  ).length;
}
