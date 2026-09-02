/**
 * booking-tracker.api.ts
 * ======================
 * Appels backend du module BookingTracker côté Expéditeur.
 *
 * RÉEL (B2, via le gateway → deal-service) :
 *   - getBooking : GET /deals/:id (vue Shipper — A13), traduit par
 *     l'adapter (A37) — le module ne voit jamais la forme backend.
 *
 *   - regenerateDeliveryCode : POST /deals/:id/code/regenerate (B3 — le
 *     nouveau code est servi, puis la page RELIT GET /deals/:id — A43)
 *
 * ENCORE MOCK (basculent avec leurs endpoints — A37) :
 *   - confirmDeliveryEarly   (B4 — COMPLETED + transfert)
 *   - submitDispute          (B4 — DISPUTED + gel du payout)
 */

import apiClient from "@/lib/api-client";
import { MAX_CODE_REGENERATIONS, type Booking } from "./booking-tracker.types";
import { toBooking, type ShipperBookingViewDto } from "./booking-tracker.adapter";

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ══ Erreur métier (pattern DealApiError, module carrier/deal) ═ */

export type BookingApiErrorCode =
  | "CODE_REGENERATION_LIMIT" // plafond 5 atteint, ou colis plus en transit (B3)
  | "TRANSITION_NOT_ALLOWED" // deux clics : un seul gagne — relire
  | "NOT_FOUND"
  | "UNAUTHENTICATED"
  | "GENERIC";

export class BookingApiError extends Error {
  readonly code: BookingApiErrorCode;
  readonly status: number;
  constructor(code: BookingApiErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function toBookingApiError(e: unknown): BookingApiError {
  const err = e as {
    response?: { status?: number; data?: { message?: string; details?: Record<string, unknown> } };
  };
  const status = err.response?.status ?? 0;
  const detailCode = err.response?.data?.details?.code;
  const code: BookingApiErrorCode =
    detailCode === "CODE_REGENERATION_LIMIT" || detailCode === "TRANSITION_NOT_ALLOWED"
      ? detailCode
      : status === 404 || status === 403
        ? "NOT_FOUND" // 403 volontairement confondu (le deal existe, pas pour toi)
        : status === 401
          ? "UNAUTHENTICATED"
          : "GENERIC";
  return new BookingApiError(
    code,
    status,
    err.response?.data?.message ?? "Booking fetch failed"
  );
}

/* ══ Appel réel ═══════════════════════════════════════════════ */

type DealResponseDto = {
  success: boolean;
  viewerRole: "SHIPPER" | "CARRIER";
  deal: ShipperBookingViewDto;
};

export async function getBooking(bookingId: string): Promise<Booking> {
  try {
    const res = await apiClient.get<DealResponseDto>(`/deals/${bookingId}`, {
      requireAuth: true,
    });
    return toBooking(res.data.deal);
  } catch (e) {
    throw toBookingApiError(e);
  }
}

/**
 * Régénère un nouveau code de livraison (plafond SERVEUR : 5, colis en
 * transit seulement). Seul l'Expéditeur peut le faire — le Voyageur ne voit
 * jamais le code. RÉEL : POST /deals/:id/code/regenerate (B3/A43).
 */
export async function regenerateDeliveryCode(
  bookingId: string
): Promise<{ bookingId: string; newCode: string; regeneratedCount: number }> {
  try {
    const res = await apiClient.post<{ bookingId: string; deliveryCode: string; codeRegenerationsLeft: number }>(
      `/deals/${bookingId}/code/regenerate`,
      {},
      { requireAuth: true }
    );
    return {
      bookingId: res.data.bookingId,
      newCode: res.data.deliveryCode,
      regeneratedCount: MAX_CODE_REGENERATIONS - res.data.codeRegenerationsLeft,
    };
  } catch (e) {
    throw toBookingApiError(e);
  }
}

/**
 * Confirmation anticipée du Sender ("tout va bien") : libère le paiement
 * immédiatement. MOCK — bascule en B4 (Deal → COMPLETED,
 * transfers.create() Stripe, notification "Versement effectué").
 * Action DÉFINITIVE : plus de signalement possible ensuite.
 */
export async function confirmDeliveryEarly(
  bookingId: string
): Promise<{ bookingId: string; confirmedAt: string }> {
  await sleep(MOCK_DELAY_MS);
  // eslint-disable-next-line no-console
  console.info("[booking] confirmDeliveryEarly mock:", bookingId);
  return { bookingId, confirmedAt: new Date().toISOString() };
}

/**
 * Envoie un signalement de litige. MOCK — bascule en B4
 * (Deal → DISPUTED, payout gelé, ticket support, accusé email ≤48 h).
 */
export async function submitDispute(
  bookingId: string,
  payload: import("./booking-tracker.types").SubmitDisputePayload
): Promise<{ bookingId: string; ticketNumber: string; submittedAt: string }> {
  await sleep(MOCK_DELAY_MS);
  if (!payload.pledgeAccepted) {
    throw new Error("PLEDGE_REQUIRED");
  }
  if (payload.description.trim().length < 50) {
    throw new Error("DESCRIPTION_TOO_SHORT");
  }
  const ticketNumber =
    "YAM-" + Math.floor(1000 + Math.random() * 9000).toString();
  // eslint-disable-next-line no-console
  console.info("[booking] submitDispute mock:", { bookingId, payload, ticketNumber });
  return { bookingId, ticketNumber, submittedAt: new Date().toISOString() };
}
