/** report.api.ts — signaler un trajet ou un membre (D68). 409 = déjà signalé. */
import apiClient from "@/lib/api-client";

export type ReportTargetType = "TRIP" | "USER";
export type ReportReason = "ILLEGAL_CONTENT" | "SCAM" | "INAPPROPRIATE" | "IMPERSONATION" | "OTHER";
export const REPORT_REASONS_BY_TARGET: Record<ReportTargetType, ReportReason[]> = {
  TRIP: ["ILLEGAL_CONTENT", "SCAM", "INAPPROPRIATE", "OTHER"],
  USER: ["SCAM", "INAPPROPRIATE", "IMPERSONATION", "OTHER"],
};

export async function createReport(input: { targetType: ReportTargetType; targetRef: string; reason: ReportReason; details?: string }): Promise<{ reportId: string; createdAt: string }> {
  const res = await apiClient.post<{ reportId: string; createdAt: string }>("/reports", input, { requireAuth: true });
  return res.data;
}
