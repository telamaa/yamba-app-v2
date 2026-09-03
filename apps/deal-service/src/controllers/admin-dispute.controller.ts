/**
 * admin-dispute.controller.ts — GET /admin/disputes, GET /admin/disputes/:id (C-PR1)
 * ==================================================================================
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ObjectIdSchema } from "@packages/api-contracts";
import type { AdminDisputeService } from "../services/admin-dispute.service";

export function makeAdminDisputeController(service: AdminDisputeService) {
  return {
    async listQueue(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.listQueue());
      } catch (e) {
        next(e);
      }
    },
    async getFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ObjectIdSchema.safeParse(req.params.id);
        if (!parsed.success) throw new ValidationError("Invalid deal id.");
        res.status(200).json(
          await service.getFile({ id: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }, parsed.data)
        );
      } catch (e) {
        next(e);
      }
    },
  };
}
