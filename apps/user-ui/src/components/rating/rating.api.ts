/**
 * rating.api.ts — GET/POST /deals/:id/rating, réels (B5-PR2)
 * ============================================================
 * Le serveur reste seul juge (`canRate`, fenêtre, double-aveugle) ; le front
 * reflète le contexte servi et affiche les refus traduits.
 */
import apiClient from "@/lib/api-client";
import type { RatingContext, SubmitRatingPayload } from "./rating.types";

export type RatingApiErrorCode = "TRANSITION_NOT_ALLOWED" | "VALIDATION" | "NOT_FOUND" | "UNAUTHENTICATED" | "GENERIC";
export class RatingApiError extends Error {
  readonly code: RatingApiErrorCode;
  constructor(code: RatingApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
function toRatingApiError(e: unknown): RatingApiError {
  const err = e as { response?: { status?: number; data?: { message?: string; details?: { code?: string } } } };
  const status = err.response?.status ?? 0;
  const code: RatingApiErrorCode =
    err.response?.data?.details?.code === "TRANSITION_NOT_ALLOWED"
      ? "TRANSITION_NOT_ALLOWED"
      : status === 400
        ? "VALIDATION"
        : status === 404 || status === 403
          ? "NOT_FOUND"
          : status === 401
            ? "UNAUTHENTICATED"
            : "GENERIC";
  return new RatingApiError(code, err.response?.data?.message ?? "Rating request failed");
}

type ContextDto = Omit<RatingContext, "dealId" | "originCity" | "destinationCity"> & {
  bookingId: string;
  corridor: { originCity: string; destinationCity: string };
};

export async function getRatingContext(dealId: string): Promise<RatingContext> {
  try {
    const res = await apiClient.get<ContextDto>(`/deals/${dealId}/rating`, { requireAuth: true });
    const d = res.data;
    return {
      dealId: d.bookingId,
      viewerRole: d.viewerRole,
      ratedRole: d.ratedRole,
      person: d.person,
      originCity: d.corridor.originCity,
      destinationCity: d.corridor.destinationCity,
      completedAt: d.completedAt,
      windowEndsAt: d.windowEndsAt,
      canRate: d.canRate,
      cannotRateReason: d.cannotRateReason,
      myRating: d.myRating,
      counterpartHasRated: d.counterpartHasRated,
      revealedAt: d.revealedAt,
      counterpartRating: d.counterpartRating,
    };
  } catch (e) {
    throw toRatingApiError(e);
  }
}

export async function submitRating(
  dealId: string,
  payload: SubmitRatingPayload
): Promise<{ submittedAt: string; revealed: boolean; revealedAt: string | null }> {
  try {
    const res = await apiClient.post<{ bookingId: string; submittedAt: string; revealed: boolean; revealedAt: string | null }>(
      `/deals/${dealId}/rating`,
      {
        rating: payload.rating,
        ...(Object.keys(payload.criteria).length ? { criteria: payload.criteria } : {}),
        ...(payload.comment ? { comment: payload.comment } : {}),
      },
      { requireAuth: true }
    );
    return { submittedAt: res.data.submittedAt, revealed: res.data.revealed, revealedAt: res.data.revealedAt };
  } catch (e) {
    throw toRatingApiError(e);
  }
}
