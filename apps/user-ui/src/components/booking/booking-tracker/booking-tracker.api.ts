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
 *   - confirmDeliveryEarly   RÉEL (B4-PR2) — POST /deals/:id/confirm
 *   - submitDispute          RÉEL (B4-PR2) — POST /deals/:id/dispute
 */

import apiClient from "@/lib/api-client";
import { MAX_CODE_REGENERATIONS, type Booking } from "./booking-tracker.types";
import { toBooking, type ShipperBookingViewDto } from "./booking-tracker.adapter";

/** D69 — lien de suivi du destinataire : POST /deals/:id/tracking-link (créé une fois, Expéditeur seul). */
export type TrackingLinkDto = { token: string; path: string; recipientFirstName: string; recipientPhoneE164: string | null };
export async function issueTrackingLink(bookingId: string): Promise<TrackingLinkDto> {
  const res = await apiClient.post<TrackingLinkDto>(`/deals/${bookingId}/tracking-link`, undefined, { requireAuth: true });
  return res.data;
}

/* ══ Erreur métier (pattern DealApiError, module carrier/deal) ═ */

export type BookingApiErrorCode =
  | "CODE_REGENERATION_LIMIT" // plafond 5 atteint, ou colis plus en transit (B3)
  | "TRANSITION_NOT_ALLOWED" // deux clics : un seul gagne — relire
  | "VALIDATION" // 400 : corps refusé par le serveur (B4 : description, pledge, catégorie en transit)
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
      : status === 400
        ? "VALIDATION"
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
 * Confirmation anticipée (B4-PR2, réel) : le serveur passe le deal en
 * COMPLETED puis tente le versement EN LIGNE (A67). Action DÉFINITIVE
 * (INV-3). L'appelant RELIT le deal : la vue « Envoi terminé » vient de
 * GET /deals/:id, jamais d'un cache local.
 */
export async function confirmDeliveryEarly(
  bookingId: string
): Promise<{ bookingId: string; confirmedAt: string; payoutStatus: "SENT" | "FAILED" }> {
  try {
    const res = await apiClient.post<{ bookingId: string; completedAt: string; payoutStatus: "SENT" | "FAILED" }>(
      `/deals/${bookingId}/confirm`,
      {},
      { withCredentials: true }
    );
    return { bookingId: res.data.bookingId, confirmedAt: res.data.completedAt, payoutStatus: res.data.payoutStatus };
  } catch (e) {
    throw toBookingApiError(e);
  }
}

/**
 * Signalement (B4-PR2, réel) : DISPUTED + gel + ticket YAM-XXXX + dossier.
 * Les photos sont DÉJÀ en ligne (upload direct D42, dossier `deals/dispute/`,
 * A73) : seules leurs URL voyagent. Le serveur reste seul juge (fenêtre
 * J+4, 48 h après le départ en transit, catégorie imposée, ≥ 50 caractères).
 */
export async function submitDispute(
  bookingId: string,
  payload: import("./booking-tracker.types").SubmitDisputePayload
): Promise<{ bookingId: string; ticketNumber: string; submittedAt: string }> {
  try {
    const res = await apiClient.post<{ bookingId: string; ticketNumber: string; disputedAt: string }>(
      `/deals/${bookingId}/dispute`,
      {
        category: payload.category,
        description: payload.description,
        pledgeAccepted: payload.pledgeAccepted,
        photoUrls: payload.photoUrls,
        ...(payload.desiredOutcome ? { desiredOutcome: payload.desiredOutcome } : {}),
      },
      { withCredentials: true }
    );
    return { bookingId: res.data.bookingId, ticketNumber: res.data.ticketNumber, submittedAt: res.data.disputedAt };
  } catch (e) {
    throw toBookingApiError(e);
  }
}
