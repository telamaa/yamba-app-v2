/**
 * report.controller.ts — signalement d'un trajet ou d'un membre (D68)
 * ====================================================================
 *  POST  /reports                 membre connecté        (isAuthenticated)
 *  GET   /admin/reports?status=   file trajets/membres   (reports.review)
 *  PATCH /admin/reports/:id       décision journalisée   (reports.review)
 */
import type { NextFunction, Response } from "express";
import { CreateReportRequestSchema, ReportStatusSchema, ReviewReportRequestSchema } from "@packages/api-contracts";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { makeReportService, type ReportService } from "../services/report.service";

export function makeReportController(service: ReportService = makeReportService()) {
  return {
    async createReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = CreateReportRequestSchema.safeParse(req.body);
        if (!parsed.success) return next(new ValidationError("Invalid report.", parsed.error.flatten()));
        res.status(201).json(await service.createReport(req.user.id, parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async adminList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const status = ReportStatusSchema.safeParse(req.query.status ?? "OPEN");
        if (!status.success) return next(new ValidationError("Invalid status."));
        res.status(200).json(await service.listReports(status.data));
      } catch (e) {
        next(e);
      }
    },
    async adminReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ReviewReportRequestSchema.safeParse(req.body);
        if (!parsed.success) return next(new ValidationError("Invalid decision.", parsed.error.flatten()));
        const actor = { id: req.user.id as string, ip: req.ip ?? null, userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
        res.status(200).json(await service.reviewReport(actor, req.params.id as string, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
