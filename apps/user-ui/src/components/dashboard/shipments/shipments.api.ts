import apiClient from "@/lib/api-client";
import { toShipmentListItems } from "./shipments.adapter";
import type { ShipperBookingViewDto } from "./shipments.adapter";
import { mockShipments } from "./shipments.state";
import type { ShipmentListItem } from "./shipments.types";

/**
 * Couche API du module Mes envois.
 *
 * - getMyShipments()        → page réelle /dashboard/shipments.
 *   Branchée (PR5) sur GET /me/bookings via le gateway — le TODO
 *   gravé ici depuis la naissance du module est honoré : le backend
 *   (deal-service, PR3) répond MyBookingsResponse {success, bookings,
 *   count} ; l'adaptateur traduit vers ShipmentListItem.
 *
 * - getMyShipmentsPreview() → vitrine mock /dashboard/shipments/preview
 *   (tous les cas de figure de la machine d'état) — CONSERVÉE : outil
 *   de QA visuelle permanent.
 */

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MyBookingsResponse = {
  success: boolean;
  bookings: ShipperBookingViewDto[];
  count: number;
};

export async function getMyShipments(): Promise<ShipmentListItem[]> {
  const res = await apiClient.get<MyBookingsResponse>("/me/bookings", {
    requireAuth: true,
  });
  return toShipmentListItems(res.data.bookings);
}

export async function getMyShipmentsPreview(): Promise<ShipmentListItem[]> {
  await sleep(MOCK_DELAY_MS);
  return [...mockShipments];
}
