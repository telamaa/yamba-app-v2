/**
 * deal.api.ts
 * ===========
 * Wrapper côté client pour les appels backend liés au Deal côté Voyageur.
 * Mock pour l'instant — à brancher sur deal-service via le gateway dans
 * la PR backend.
 */

import type {
  AcceptPayload,
  ConfirmPickupPayload,
  DealRequest,
  DeclinePayload,
  RefusePickupPayload,
} from "./deal.types";
import { mockDealRequest } from "./deal.state";

const MOCK_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getDealRequest(dealId: string): Promise<DealRequest> {
  await sleep(MOCK_DELAY_MS);
  return { ...mockDealRequest, id: dealId || mockDealRequest.id };
}

export async function acceptDeal(
  dealId: string,
  payload: AcceptPayload
): Promise<{ dealId: string; deliveryCode: string }> {
  await sleep(MOCK_DELAY_MS);
  if (!payload.charterAccepted) {
    throw new Error("Charter must be accepted");
  }
  // eslint-disable-next-line no-console
  console.info("[deal] acceptDeal mock:", { dealId, payload });
  return {
    dealId,
    deliveryCode: generateMockCode(),
  };
}

export async function declineDeal(
  dealId: string,
  payload: DeclinePayload
): Promise<{ dealId: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[deal] declineDeal mock:", { dealId, payload });
  return { dealId };
}

/**
 * Confirme la prise en charge du colis.
 * Côté backend (PR future) : passe le Deal en PICKED_UP et révèle
 * le code de livraison à l'Expéditeur (jamais au Voyageur).
 */
export async function confirmPickup(
  dealId: string,
  payload: ConfirmPickupPayload
): Promise<{ dealId: string; status: "PICKED_UP" }> {
  await sleep(MOCK_DELAY_MS);
  if (payload.checklist.length < 5) {
    throw new Error("All checklist items must be checked");
  }
  if (payload.photos.length < 1) {
    throw new Error("At least one photo is required");
  }
  // eslint-disable-next-line no-console
  console.info("[deal] confirmPickup mock:", { dealId, payload });
  return { dealId, status: "PICKED_UP" };
}

/**
 * Refuse le colis au moment du pickup (contenu non conforme, etc.).
 * Côté backend (PR future) : annule le Deal, rembourse l'Expéditeur,
 * aucune pénalité pour le Voyageur.
 */
export async function refusePickup(
  dealId: string,
  payload: RefusePickupPayload
): Promise<{ dealId: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[deal] refusePickup mock:", { dealId, payload });
  return { dealId };
}

function generateMockCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
