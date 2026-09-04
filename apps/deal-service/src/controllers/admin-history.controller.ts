/**
 * admin-history.controller.ts — GET /admin/deals/:id/history (C-PR6a, D59 5A) — deals.history.read, journalisé
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ObjectIdSchema } from "@packages/api-contracts";
import type { AdminHistoryService } from "../services/admin-history.service";

export function makeAdminHistoryController(service: AdminHistoryService) {
  return {
    async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ObjectIdSchema.safeParse(req.params.id);
        if (!parsed.success) throw new ValidationError("Invalid deal id.");
        res.status(200).json(await service.getDealHistory({ id: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
