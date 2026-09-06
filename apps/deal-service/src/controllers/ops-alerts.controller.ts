/** ops-alerts.controller.ts — GET /admin/alerts (C-PR6b, D59 4A) — calculées à la lecture, kpi.read */
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import type { OpsAlertsService } from "../services/ops-alerts.service";

export function makeOpsAlertsController(service: OpsAlertsService) {
  return {
    async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.evaluate());
      } catch (e) {
        next(e);
      }
    },
  };
}
