/**
 * deal.api.ts
 * ===========
 * Appels backend du module Deal côté Voyageur.
 *
 * TOUS RÉELS (via le gateway → deal-service) :
 *   - getDealRequest       : GET /deals/:id (vue Carrier — A13)
 *   - acceptDeal           : POST /deals/:id/accept  (charte, gate D31, capture D39)
 *   - declineDeal          : POST /deals/:id/decline (raison É2 optionnelle)
 *   - confirmPickup        : POST /deals/:id/pickup (B3 — checklist 5/5 + URLs
 *                            ImageKit déjà téléversées par le client, D42/A43)
 *   - refusePickup         : POST /deals/:id/pickup/refuse (raison seule — A40)
 *   - confirmTrackingEvent : POST /deals/:id/events (appelé APRÈS l'undo — A39)
 *   - validateDeliveryCode : POST /deals/:id/deliver (compteur SERVEUR — A38)
 */

import apiClient from "@/lib/api-client";
import type {
  AcceptPayload,
  ConfirmPickupApiPayload,
  DealRequest,
  DealStatus,
  DealTrackingEventId,
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

/* ══ Erreur métier (pattern BookingApiError) ══════════════════ */

/** Codes 409 du cycle de vie + du transport (BOOKING_LIFECYCLE_ERROR_CODES) + états transverses — le composant traduit. */
export type DealApiErrorCode =
  | "TRANSITION_NOT_ALLOWED"
  | "CARRIER_ONBOARDING_REQUIRED"
  | "PAYMENT_STATE_CONFLICT"
  | "DELIVERY_CODE_INVALID" // details.attemptsLeft (A38)
  | "DELIVERY_LOCKED" // details.lockedUntil (A38)
  | "DELIVERY_CODE_UNAVAILABLE"
  | "TRACKING_STEP_NOT_ALLOWED"
  | "CODE_REGENERATION_LIMIT"
  | "NOT_FOUND"
  | "UNAUTHENTICATED"
  | "GENERIC";

const KNOWN_CODES: readonly DealApiErrorCode[] = [
  "TRANSITION_NOT_ALLOWED",
  "CARRIER_ONBOARDING_REQUIRED",
  "PAYMENT_STATE_CONFLICT",
  "DELIVERY_CODE_INVALID",
  "DELIVERY_LOCKED",
  "DELIVERY_CODE_UNAVAILABLE",
  "TRACKING_STEP_NOT_ALLOWED",
  "CODE_REGENERATION_LIMIT",
];

export class DealApiError extends Error {
  readonly code: DealApiErrorCode;
  readonly status: number;
  /** `details` du 409 (ex. attemptsLeft, lockedUntil) — le serveur est seul juge. */
  readonly details: Record<string, unknown>;
  constructor(code: DealApiErrorCode, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function toDealApiError(e: unknown): DealApiError {
  const err = e as {
    response?: { status?: number; data?: { message?: string; details?: Record<string, unknown> } };
  };
  const status = err.response?.status ?? 0;
  const details = err.response?.data?.details ?? {};
  const detailCode = details.code;
  const code: DealApiErrorCode =
    typeof detailCode === "string" && (KNOWN_CODES as readonly string[]).includes(detailCode)
      ? (detailCode as DealApiErrorCode)
      : status === 404 || status === 403
        ? "NOT_FOUND" // 403 volontairement confondu (le deal existe, pas pour toi)
        : status === 401
          ? "UNAUTHENTICATED"
          : "GENERIC";
  return new DealApiError(code, status, err.response?.data?.message ?? "Deal request failed", details);
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

/* ══ B3 — transport (tout réel) ═══════════════════════════════ */

/** Miroirs d'affichage des constantes SERVEUR (booking-state-machine) — le serveur reste seul juge. */
export const MAX_DELIVERY_ATTEMPTS = 3;
export const DELIVERY_LOCK_MINUTES = 15;

/**
 * Confirme la prise en charge : checklist 5/5 + URLs des photos DÉJÀ
 * téléversées vers ImageKit par le client (D42/A43). Le serveur passe le
 * Deal en PICKED_UP et génère le code — révélé à l'Expéditrice seule.
 */
export async function confirmPickup(
  dealId: string,
  payload: ConfirmPickupApiPayload
): Promise<DealTransitionResult> {
  try {
    const res = await apiClient.post<DealTransitionResult>(
      `/deals/${dealId}/pickup`,
      { checklist: payload.checklist, photoUrls: payload.photoUrls, notes: payload.notes ?? null },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}

/**
 * Refuse le colis à la remise (raison seule — A40) : le serveur annule,
 * rembourse intégralement et restitue les kg, sans pénalité.
 */
export async function refusePickup(
  dealId: string,
  payload: RefusePickupPayload
): Promise<DealTransitionResult> {
  try {
    const res = await apiClient.post<DealTransitionResult>(
      `/deals/${dealId}/pickup/refuse`,
      { reason: payload.reason ?? null },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}

export type TrackingStepResult = {
  bookingId: string;
  step: DealTrackingEventId;
  confirmedAt: string;
  trackingEvents: { step: DealTrackingEventId; confirmedAt: string }[];
};

/**
 * Confirme un jalon optionnel — à appeler APRÈS la fenêtre d'undo (A39) :
 * le serveur n'a pas d'annulation, la séquence est stricte (409 sinon).
 */
export async function confirmTrackingEvent(
  dealId: string,
  step: DealTrackingEventId
): Promise<TrackingStepResult> {
  try {
    const res = await apiClient.post<TrackingStepResult>(
      `/deals/${dealId}/events`,
      { step },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}

export type DeliverResult = {
  bookingId: string;
  status: "DELIVERED";
  deliveredAt: string;
  payoutDueAt: string;
};

/**
 * Valide le code de livraison. Le serveur compare (bcrypt) et COMPTE :
 * mauvais code → DealApiError DELIVERY_CODE_INVALID (details.attemptsLeft),
 * 3e échec → DELIVERY_LOCKED (details.lockedUntil), verrou actif →
 * TRANSITION_NOT_ALLOWED. Aucun compteur côté client (A38).
 */
export async function validateDeliveryCode(
  dealId: string,
  code: string,
  photoUrls: string[] = [] // A76 — photos de remise OPTIONNELLES, déjà en ligne
): Promise<DeliverResult> {
  try {
    const res = await apiClient.post<DeliverResult>(
      `/deals/${dealId}/deliver`,
      { code, photoUrls },
      { requireAuth: true }
    );
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}

/* ── C-PR2 (D55 1A) — la version du Voyageur sur un litige ouvert ──────── */
export type DisputeStatementResult = { bookingId: string; ticketNumber: string; respondedAt: string };

export async function submitDisputeStatement(
  dealId: string,
  input: { statement: string; photoUrls: string[] }
): Promise<DisputeStatementResult> {
  try {
    const res = await apiClient.post<DisputeStatementResult>(`/deals/${dealId}/dispute/statement`, input, { requireAuth: true });
    return res.data;
  } catch (e) {
    throw toDealApiError(e);
  }
}
