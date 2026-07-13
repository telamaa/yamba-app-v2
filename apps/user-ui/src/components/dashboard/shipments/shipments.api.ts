import { mockShipments } from "./shipments.state";
import type { ShipmentListItem } from "./shipments.types";

/**
 * Couche API du module Mes envois.
 *
 * - getMyShipments()        → page réelle /dashboard/shipments.
 *   ⚠️ Le backend bookings n'existe pas encore : retourne [] (état réel
 *   de la base). À brancher sur GET /me/bookings via le gateway quand le
 *   booking-service sera livré (spec fonctionnelle §6) — la signature et
 *   le DTO ShipmentListItem sont déjà le contrat cible.
 *
 * - getMyShipmentsPreview() → vitrine mock /dashboard/shipments/preview
 *   (tous les cas de figure de la machine d'état).
 */

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMyShipments(): Promise<ShipmentListItem[]> {
  await sleep(300);
  console.info("[shipments] getMyShipments live: backend non branché → []");
  // TODO backend : const res = await apiClient.get("/me/bookings", { requireAuth: true });
  return [];
}

export async function getMyShipmentsPreview(): Promise<ShipmentListItem[]> {
  await sleep(MOCK_DELAY_MS);
  console.info("[shipments] getMyShipmentsPreview mock:", mockShipments.length, "items");
  return [...mockShipments];
}
