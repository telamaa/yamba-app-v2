/**
 * reports.schema.ts — signalement d'un trajet ou d'un membre (D68, SIG-01…04)
 * ============================================================================
 * Un seul endpoint membre (`POST /reports`), des motifs FERMÉS par cible, une file admin.
 * `targetRef` est l'identifiant PUBLIC de la cible : l'id d'un trajet, le slug d'un membre
 * (le DTO public d'un membre ne porte pas son id) — le serveur le résout.
 */
import { z } from "zod";
import { TrustLevelSchema } from "./trust.schema"; // D71

export const REPORT_TARGET_TYPES = ["TRIP", "USER"] as const;
export const ReportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES).meta({ id: "ReportTargetType" });
export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;

export const REPORT_REASONS = ["ILLEGAL_CONTENT", "SCAM", "INAPPROPRIATE", "IMPERSONATION", "OTHER"] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS).meta({ id: "ReportReason" });
export type ReportReason = z.infer<typeof ReportReasonSchema>;

/** Motifs proposés par cible (SIG-01) — le serveur refuse un motif hors liste. */
export const REPORT_REASONS_BY_TARGET: Record<ReportTargetType, readonly ReportReason[]> = {
  TRIP: ["ILLEGAL_CONTENT", "SCAM", "INAPPROPRIATE", "OTHER"],
  USER: ["SCAM", "INAPPROPRIATE", "IMPERSONATION", "OTHER"],
};

/** SIG-03 — à partir de N signalements ouverts sur une même cible, la revue est prioritaire (jamais de sanction automatique). */
export const REPORT_REVIEW_THRESHOLD = 3;

export const CreateReportRequestSchema = z
  .object({
    targetType: ReportTargetTypeSchema,
    targetRef: z.string().trim().min(1).max(128),
    reason: ReportReasonSchema,
    details: z.string().trim().max(500).optional(),
  })
  .meta({ id: "CreateReportRequest" });
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

export const CreateReportResponseSchema = z.object({ reportId: z.string(), createdAt: z.string().datetime() }).meta({ id: "CreateReportResponse" });
export type CreateReportResponse = z.infer<typeof CreateReportResponseSchema>;

export const ReportStatusSchema = z.enum(["OPEN", "REVIEWED", "DISMISSED"]).meta({ id: "ReportStatus" });
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const AdminReportItemSchema = z
  .object({
    id: z.string(),
    targetType: ReportTargetTypeSchema,
    targetId: z.string(),
    /** Ce que le support lit : corridor d'un trajet, prénom + nom d'un membre. */
    targetLabel: z.string(),
    /** Propriétaire d'un trajet signalé (null pour un membre : la cible est le membre). */
    targetOwner: z.object({ id: z.string(), firstName: z.string() }).nullable(),
    status: ReportStatusSchema,
    reason: ReportReasonSchema,
    details: z.string().nullable(),
    createdAt: z.string().datetime(),
    reporter: z.object({ id: z.string(), firstName: z.string() }),
    /** Signalements OUVERTS sur la même cible (tous auteurs). */
    openCountOnTarget: z.number().int(),
    /** SIG-03 — openCountOnTarget ≥ REPORT_REVIEW_THRESHOLD, ou membre visé à risque (D71). */
    priority: z.boolean(),
    /** D71 — niveau de risque interne du membre visé (ou du propriétaire du trajet). */
    targetTrustLevel: TrustLevelSchema.nullable(),
  })
  .meta({ id: "AdminReportItem" });
export type AdminReportItem = z.infer<typeof AdminReportItemSchema>;

export const AdminReportsResponseSchema = z.object({ items: z.array(AdminReportItemSchema), total: z.number().int() }).meta({ id: "AdminReportsResponse" });
export type AdminReportsResponse = z.infer<typeof AdminReportsResponseSchema>;

export const ReviewReportRequestSchema = z
  .object({ decision: z.enum(["REVIEWED", "DISMISSED"]), note: z.string().trim().max(500).optional() })
  .meta({ id: "ReviewReportRequest" });
export type ReviewReportRequest = z.infer<typeof ReviewReportRequestSchema>;
