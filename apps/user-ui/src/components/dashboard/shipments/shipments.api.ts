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

/** Réponse des transitions (DealTransitionResponse, contrat B2-PR2). */
type CancelShipmentResponse = {
  bookingId: string;
  status: ShipmentListItem["status"];
  /** Montant rendu (cents) — total en PENDING, barème ANN-01 en ACCEPTED. */
  refundAmountCents: number | null;
  currencyCode: string;
};

/**
 * Annulation Expéditeur (POST /deals/:id/cancel — B2-PR2).
 * Le MONTANT du remboursement est décidé par le serveur au moment T
 * (la préviz affichée avant confirmation n'était qu'informative).
 * 409 : la machine a refusé (le deal a changé) — l'appelant recharge.
 */
export async function cancelShipment(
  bookingId: string
): Promise<CancelShipmentResponse> {
  const res = await apiClient.post<CancelShipmentResponse>(
    `/deals/${bookingId}/cancel`,
    {},
    { requireAuth: true }
  );
  return res.data;
}

export async function getMyShipmentsPreview(): Promise<ShipmentListItem[]> {
  await sleep(MOCK_DELAY_MS);
  return [...mockShipments];
}
