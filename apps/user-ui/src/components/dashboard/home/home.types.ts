import {
  deriveCarrierActions,
  type CarrierAction,
  type CarrierTripItem,
} from "@/components/dashboard/trips/trips.types";
import {
  getShipmentPresentation,
  type ShipmentListItem,
} from "@/components/dashboard/shipments/shipments.types";

/**
 * Home inbox — fusion des actions des deux rôles en un seul feed.
 * Réutilise les dérivations existantes : deriveCarrierActions (Voyageur)
 * et getShipmentPresentation (Expéditeur). Aucune logique métier nouvelle.
 */

export type HomeAction =
  | { role: "CARRIER"; key: string; priority: number; deadlineMs: number; carrier: CarrierAction }
  | { role: "SHIPPER"; key: string; priority: number; deadlineMs: number; shipment: ShipmentListItem };

const NO_DEADLINE = Number.MAX_SAFE_INTEGER;

/** Priorité d'urgence commune aux deux rôles (0 = le plus urgent) */
const CARRIER_PRIORITY = { RESPOND: 0, PICKUP: 1, DELIVER: 1, RATE: 3 } as const;

function shipmentActionPriority(item: ShipmentListItem): number {
  if (item.status === "PICKED_UP" && !item.hasTrackingEvents) return 1; // code à transmettre
  if (item.status === "DELIVERED") return 1; // vérification J+4
  return 3; // COMPLETED non noté
}

function shipmentDeadlineMs(item: ShipmentListItem): number {
  if (item.status === "DELIVERED" && item.payoutAt) {
    return new Date(item.payoutAt).getTime();
  }
  return NO_DEADLINE;
}

/**
 * Fusionne et trie les actions des deux rôles.
 * Tri : priorité croissante, puis échéance croissante.
 */
export function deriveHomeActions(
  shipments: ShipmentListItem[],
  carrierTrips: CarrierTripItem[]
): HomeAction[] {
  const actions: HomeAction[] = [];

  for (const shipment of shipments) {
    if (getShipmentPresentation(shipment).group !== "action") continue;
    actions.push({
      role: "SHIPPER",
      key: "shipper_" + shipment.id,
      priority: shipmentActionPriority(shipment),
      deadlineMs: shipmentDeadlineMs(shipment),
      shipment,
    });
  }

  for (const carrier of deriveCarrierActions(carrierTrips)) {
    actions.push({
      role: "CARRIER",
      key: "carrier_" + carrier.kind + "_" + carrier.dealId,
      priority: CARRIER_PRIORITY[carrier.kind],
      deadlineMs: carrier.deadlineAt
        ? new Date(carrier.deadlineAt).getTime()
        : NO_DEADLINE,
      carrier,
    });
  }

  return actions.sort(
    (a, b) => a.priority - b.priority || a.deadlineMs - b.deadlineMs
  );
}
