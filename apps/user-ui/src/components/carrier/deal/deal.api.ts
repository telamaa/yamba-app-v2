/**
 * deal.api.ts
 * ===========
 * Appels backend du module Deal côté Voyageur.
 *
 * RÉELS (B2, via le gateway → deal-service) :
 *   - getDealRequest : GET /deals/:id (vue Carrier — A13)
 *   - acceptDeal     : POST /deals/:id/accept  (charte, gate D31, capture D39)
 *   - declineDeal    : POST /deals/:id/decline (raison É2 optionnelle)
 *
 * ENCORE MOCK (B3 — transport) : confirmPickup, refusePickup,
 * confirmTrackingEvent, validateDeliveryCode.
 */

import apiClient from "@/lib/api-client";
import type {
  AcceptPayload,
  ConfirmPickupPayload,
  DealRequest,
  DealStatus,
  DeclinePayload,
  RefusePickupPayload,
} from "./deal.types";
import { toDealRequest, type CarrierBookingViewDto } from "./deal.adapter";

/** Réponse des transitions (DealTransitionResponse, contrat B2-PR2). */
export type DealTransitionResult = {
  bookingId: string;
  status: DealStatus;
  refundAmountCents: number | null;
  currencyCode: string;
};

const MOCK_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ══ Erreur métier (pattern BookingApiError) ══════════════════ */

/** Codes 409 des transitions + états transverses — le composant traduit. */
export type DealApiErrorCode =
  | "TRANSITION_NOT_ALLOWED"
  | "CARRIER_ONBOARDING_REQUIRED"
  | "PAYMENT_STATE_CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHENTICATED"
  | "GENERIC";

export class DealApiError extends Error {
  readonly code: DealApiErrorCode;
  readonly status: number;
  constructor(code: DealApiErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function toDealApiError(e: unknown): DealApiError {
  const err = e as {
    response?: { status?: number; data?: { message?: string; details?: Record<string, unknown> } };
  };
  const status = err.response?.status ?? 0;
  const detailCode = err.response?.data?.details?.code;
  const code: DealApiErrorCode =
    typeof detailCode === "string" &&
    ["TRANSITION_NOT_ALLOWED", "CARRIER_ONBOARDING_REQUIRED", "PAYMENT_STATE_CONFLICT"].includes(detailCode)
      ? (detailCode as DealApiErrorCode)
      : status === 404 || status === 403
        ? "NOT_FOUND" // 403 volontairement confondu (le deal existe, pas pour toi)
        : status === 401
          ? "UNAUTHENTICATED"
          : "GENERIC";
  return new DealApiError(code, status, err.response?.data?.message ?? "Deal request failed");
}

/* ══ Appels réels ═════════════════════════════════════════════ */

type DealResponseDto = {
  success: boolean;
  viewerRole: "SHIPPER" | "CARRIER";
  deal: CarrierBookingViewDto;
};

export async function getDealRequest(dealId: string): Promise<DealRequest> {
  try {
    const res = await apiClient.get<DealResponseDto>(`/deals/${dealId}`, {
      requireAuth: true,
    });
    return toDealRequest(res.data.deal);
  } catch (e) {
    throw toDealApiError(e);
  }
}

export async function acceptDeal(
  dealId: string,
  payload: AcceptPayload
): Promise<DealTransitionResult> {
  try {
    const res = await apiClient.post<DealTransitionResult>(
      `/deals/${dealId}/accept`,
      { charterAccepted: payload.charterAccepted },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}

export async function declineDeal(
  dealId: string,
  payload: DeclinePayload
): Promise<DealTransitionResult> {
  try {
    const res = await apiClient.post<DealTransitionResult>(
      `/deals/${dealId}/decline`,
      { reason: payload.reason ?? null },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
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
