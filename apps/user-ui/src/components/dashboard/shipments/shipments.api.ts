import { mockShipments } from "./shipments.state";
import type { ShipmentListItem } from "./shipments.types";

/**
 * Couche API mock du module Mes envois.
 * Contrat backend cible : GET /me/bookings (vue Expéditeur, résumés).
 * Le tri/groupement est fait côté client (getShipmentPresentation).
 */

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMyShipments(): Promise<ShipmentListItem[]> {
  await sleep(MOCK_DELAY_MS);
  console.info("[shipments] getMyShipments mock:", mockShipments.length, "items");
  return [...mockShipments];
}
