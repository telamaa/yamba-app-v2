/**
 * report.service.ts — signalement d'un trajet ou d'un membre (D68, SIG-01…04)
 * ============================================================================
 * Un endpoint membre, une file admin. La cible est résolue depuis son identifiant PUBLIC
 * (id de trajet, slug de membre). Aucun effet automatique : la décision appartient au support
 * (masquage D57, sanction D56) et est journalisée. L'auteur reçoit un accusé de réception,
 * jamais la suite ; la cible n'apprend jamais qui a signalé (SIG-04).
 */
import prisma from "@packages/libs/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AdminReportItem, AdminReportsResponse, CreateReportRequest, CreateReportResponse, ReportStatus, ReportTargetType, ReviewReportRequest } from "@packages/api-contracts";
import { canReport, needsPriorityReview } from "../utils/report.rules";
import { getAuthEmails } from "../emails/auth-emails";
import { sendAuthEmail } from "../emails/send-auth-email";

export type AdminActor = { id: string; ip: string | null; userAgent: string | null };
type Row = Record<string, unknown>;
export type ReportDb = {
  trip: { findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]> };
  user: { findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]> };
  report: { findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]>; create(args: Row): Promise<Row>; updateMany(args: Row): Promise<{ count: number }> };
  adminAction: { create(args: Row): Promise<Row> };
  $transaction<T>(fn: (tx: ReportDb) => Promise<T>): Promise<T>;
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.com";

export function makeReportService(deps: { db?: ReportDb; sendEmail?: typeof sendAuthEmail } = {}) {
  const db = deps.db ?? (prisma as unknown as ReportDb);
  const sendEmail = deps.sendEmail ?? sendAuthEmail;

  /** Résout la cible depuis son identifiant public : { id, ownerId } ou 404 si invisible. */
  async function resolveTarget(targetType: ReportTargetType, targetRef: string): Promise<{ id: string; ownerId: string }> {
    if (targetType === "TRIP") {
      const trip = await db.trip.findFirst({ where: { id: targetRef, isDeleted: false }, select: { id: true, userId: true } });
      if (!trip) throw new NotFoundError("Trip not found.");
      return { id: trip.id as string, ownerId: trip.userId as string };
    }
    const user = await db.user.findFirst({ where: { publicSlug: targetRef, isDeleted: false, profilePublic: true }, select: { id: true } });
    if (!user) throw new NotFoundError("Member not found.");
    return { id: user.id as string, ownerId: user.id as string };
  }

  return {
    /** POST /reports — 400 OWN_TARGET / REASON_NOT_ALLOWED, 404 cible invisible, 409 doublon ouvert. */
    async createReport(reporterId: string, input: CreateReportRequest): Promise<CreateReportResponse> {
      const target = await resolveTarget(input.targetType, input.targetRef);
      const existing = await db.report.findFirst({ where: { reporterUserId: reporterId, targetType: input.targetType, targetId: target.id, status: "OPEN" }, select: { id: true } });
      const verdict = canReport({ reporterId, targetType: input.targetType, targetOwnerId: target.ownerId, reason: input.reason, alreadyOpen: !!existing });
      if (!verdict.allowed) {
        if (verdict.reason === "ALREADY_REPORTED") throw new ConflictError("You already reported this.");
        throw new ValidationError(verdict.reason === "OWN_TARGET" ? "You cannot report your own trip or profile." : "This reason is not allowed for this target.", { code: verdict.reason });
      }
      const report = await db.report.create({
        data: { reporterUserId: reporterId, targetType: input.targetType, targetId: target.id, reason: input.reason, details: input.details?.trim() || null, status: "OPEN" },
        select: { id: true, createdAt: true },
      });
      // D68 2A — accusé de réception, best effort. Tout résolveur de destinataire saute isDeleted ET emailSuppressedAt (D35).
      const reporter = await db.user.findFirst({ where: { id: reporterId, isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] }, select: { email: true, firstName: true, preferredLocale: true } });
      if (reporter) {
        const locale = reporter.preferredLocale as string | null;
        await sendEmail(reporter.email as string, locale, getAuthEmails(locale).reportReceived({ firstName: reporter.firstName as string, supportEmail: SUPPORT_EMAIL })).catch(() => false);
      }
      return { reportId: report.id as string, createdAt: (report.createdAt as Date).toISOString() };
    },

    /** GET /admin/reports?status= — trajets et membres, les plus anciens d'abord ; « prioritaire » dès 3 ouverts sur une cible. */
    async listReports(status: ReportStatus): Promise<AdminReportsResponse> {
      const reports = await db.report.findMany({ where: { targetType: { in: ["TRIP", "USER"] }, status }, orderBy: { createdAt: "asc" }, take: 200 });
      if (reports.length === 0) return { items: [], total: 0 };
      const tripIds = reports.filter((r) => r.targetType === "TRIP").map((r) => r.targetId as string);
      const userTargetIds = reports.filter((r) => r.targetType === "USER").map((r) => r.targetId as string);
      const trips = tripIds.length ? await db.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, userId: true, originCity: true, destinationCity: true } }) : [];
      const byTrip = new Map(trips.map((t) => [t.id as string, t]));
      const openRows = await db.report.findMany({ where: { targetType: { in: ["TRIP", "USER"] }, status: "OPEN", targetId: { in: [...new Set(reports.map((r) => r.targetId as string))] } }, select: { targetId: true } });
      const openCount = new Map<string, number>();
      for (const r of openRows) openCount.set(r.targetId as string, (openCount.get(r.targetId as string) ?? 0) + 1);
      const userIds = new Set<string>([...userTargetIds, ...reports.map((r) => r.reporterUserId as string), ...trips.map((t) => t.userId as string)]);
      const users = await db.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, firstName: true, lastName: true } });
      const byUser = new Map(users.map((u) => [u.id as string, u]));
      const items: AdminReportItem[] = [];
      for (const r of reports) {
        const targetId = r.targetId as string;
        const type = r.targetType as ReportTargetType;
        let targetLabel = "—";
        let targetOwner: AdminReportItem["targetOwner"] = null;
        if (type === "TRIP") {
          const trip = byTrip.get(targetId);
          if (!trip) continue; // trajet purgé : hors file
          targetLabel = `${trip.originCity} → ${trip.destinationCity}`;
          const owner = byUser.get(trip.userId as string);
          targetOwner = { id: trip.userId as string, firstName: (owner?.firstName as string) ?? "—" };
        } else {
          const u = byUser.get(targetId);
          if (!u) continue;
          targetLabel = `${u.firstName} ${u.lastName}`.trim();
        }
        const reporter = byUser.get(r.reporterUserId as string);
        const count = openCount.get(targetId) ?? 0;
        items.push({
          id: r.id as string,
          targetType: type,
          targetId,
          targetLabel,
          targetOwner,
          status: r.status as ReportStatus,
          reason: r.reason as AdminReportItem["reason"],
          details: (r.details as string | null) ?? null,
          createdAt: (r.createdAt as Date).toISOString(),
          reporter: { id: r.reporterUserId as string, firstName: (reporter?.firstName as string) ?? "—" },
          openCountOnTarget: count,
          priority: needsPriorityReview(count),
        });
      }
      return { items, total: items.length };
    },

    /** PATCH /admin/reports/:id — décision + journal dans la même transaction ; 409 si déjà traité. */
    async reviewReport(actor: AdminActor, reportId: string, input: ReviewReportRequest): Promise<{ id: string; status: ReportStatus }> {
      const report = await db.report.findFirst({ where: { id: reportId, targetType: { in: ["TRIP", "USER"] } }, select: { id: true, status: true, targetType: true, targetId: true } });
      if (!report) throw new NotFoundError("Report not found.");
      if (report.status !== "OPEN") throw new ConflictError("This report has already been reviewed.");
      await db.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status: input.decision } });
        if (updated.count !== 1) throw new ConflictError("This report has already been reviewed.");
        await recordAdminAction(tx as never, {
          adminUserId: actor.id,
          action: "REPORT_REVIEWED",
          targetType: "REPORT",
          targetId: report.id as string,
          before: { status: "OPEN", targetType: report.targetType, targetId: report.targetId },
          after: { status: input.decision, note: input.note?.trim() || null },
          ip: actor.ip,
          userAgent: actor.userAgent,
        });
      });
      return { id: report.id as string, status: input.decision };
    },
  };
}
export type ReportService = ReturnType<typeof makeReportService>;
