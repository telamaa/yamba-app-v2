/**
 * admin-conversations.controller.ts — validation d'entrée, rien d'autre (F-PR3, D61 7A)
 * ======================================================================================
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { AdminMessageReportsQuerySchema, ObjectIdSchema, ReviewMessageReportRequestSchema } from "@packages/api-contracts";
import type { AdminActor, AdminConversationService } from "../services/admin-conversation.service";

function actorOf(req: AuthenticatedRequest): AdminActor {
  return { id: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function id(raw: unknown, what: string): string {
  const parsed = ObjectIdSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(`Invalid ${what}.`);
  return parsed.data;
}

export function makeAdminConversationsController(service: AdminConversationService) {
  return {
    async viewByDeal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.viewByDeal(actorOf(req), id(req.params.bookingId, "deal id")));
      } catch (e) {
        next(e);
      }
    },
    async listReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = AdminMessageReportsQuerySchema.safeParse(req.query);
        if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.issues);
        res.status(200).json(await service.listReports(parsed.data.status));
      } catch (e) {
        next(e);
      }
    },
    async reviewReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ReviewMessageReportRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request.", parsed.error.issues);
        res.status(200).json(await service.reviewReport(actorOf(req), id(req.params.id, "report id"), parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
