/**
 * deal-request.api.ts
 * ===================
 * Wrapper côté client pour les appels backend liés à la réception d'un Deal
 * côté voyageur. Mock pour l'instant — à brancher sur deal-service via le
 * gateway dans la PR backend.
 */

import type {
  AcceptPayload,
  DealRequest,
  DeclinePayload,
} from "./deal-request.types";
import { mockDealRequest } from "./deal-request.state";

const MOCK_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Récupère la demande de Deal pour un voyageur.
 * MVP: retourne le mock peu importe le dealId.
 */
export async function getDealRequest(dealId: string): Promise<DealRequest> {
  await sleep(MOCK_DELAY_MS);
  // Plus tard:
  // const res = await fetch(`${API_BASE}/carrier/deals/${dealId}`, { credentials: "include" });
  // if (!res.ok) throw new Error("Failed to fetch deal request");
  // return res.json();
  return { ...mockDealRequest, id: dealId || mockDealRequest.id };
}

/**
 * Accepte un Deal. Côté backend, déclenchera la capture Stripe et
 * la génération du code à 6 chiffres.
 */
export async function acceptDeal(
  dealId: string,
  payload: AcceptPayload
): Promise<{ dealId: string; deliveryCode: string }> {
  await sleep(MOCK_DELAY_MS);
  if (!payload.charterAccepted) {
    throw new Error("Charter must be accepted");
  }
  // eslint-disable-next-line no-console
  console.info("[deal-request] acceptDeal mock:", { dealId, payload });
  return {
    dealId,
    deliveryCode: generateMockCode(),
  };
}

/**
 * Refuse un Deal avec une raison + détails optionnels.
 */
export async function declineDeal(
  dealId: string,
  payload: DeclinePayload
): Promise<{ dealId: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[deal-request] declineDeal mock:", { dealId, payload });
  return { dealId };
}

function generateMockCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
