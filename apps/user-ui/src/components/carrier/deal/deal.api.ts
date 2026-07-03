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
import {mockDealPickedUp, mockDealRequest} from "./deal.state";

const MOCK_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getDealRequest(dealId: string): Promise<DealRequest> {
  await sleep(MOCK_DELAY_MS);
  const base = dealId.includes("picked") ? mockDealPickedUp : mockDealRequest;
  return { ...base, id: dealId || base.id };
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


/**
 * Confirme un événement de suivi optionnel (philosophie A+B).
 * Backend futur : push notification à l'Expéditeur + timeline mise à jour.
 */
export async function confirmTrackingEvent(
  dealId: string,
  eventId: import("./deal.types").DealTrackingEventId
): Promise<{ dealId: string; eventId: string; at: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[deal] confirmTrackingEvent mock:", { dealId, eventId });
  return { dealId, eventId, at: new Date().toISOString() };
}


// ============================================================
// Livraison — saisie du code (feat/delivery-code-entry)
// ============================================================

/** Code correct du mock (= celui révélé côté Expéditeur : 742 891) */
const MOCK_VALID_CODE = "742891";
export const MAX_DELIVERY_ATTEMPTS = 3;
export const DELIVERY_LOCK_MINUTES = 15;

export type ValidateCodeResult =
  | { ok: true; dealId: string; deliveredAt: string }
  | { ok: false; reason: "WRONG_CODE"; attemptsLeft: number }
  | { ok: false; reason: "LOCKED"; lockedUntil: string };

/**
 * Valide le code de livraison saisi par le Voyageur.
 * Backend futur : comparaison bcrypt avec le hash en base, Deal → DELIVERED,
 * TrackingEvent DELIVERED, démarrage du timer J+1→J+4, notif à l'Expéditeur.
 * Mock : code correct = 742891, compteur de tentatives géré côté client.
 */
export async function validateDeliveryCode(
  dealId: string,
  code: string,
  attemptsSoFar: number
): Promise<ValidateCodeResult> {
  await sleep(MOCK_DELAY_MS);

  if (code === MOCK_VALID_CODE) {
    // eslint-disable-next-line no-console
    console.info("[deal] validateDeliveryCode mock: SUCCESS", { dealId });
    return { ok: true, dealId, deliveredAt: new Date().toISOString() };
  }

  const attemptsLeft = MAX_DELIVERY_ATTEMPTS - attemptsSoFar - 1;
  // eslint-disable-next-line no-console
  console.info("[deal] validateDeliveryCode mock: WRONG_CODE", {
    dealId,
    attemptsLeft,
  });

  if (attemptsLeft <= 0) {
    const lockedUntil = new Date(
      Date.now() + DELIVERY_LOCK_MINUTES * 60 * 1000
    ).toISOString();
    return { ok: false, reason: "LOCKED", lockedUntil };
  }

  return { ok: false, reason: "WRONG_CODE", attemptsLeft };
}
