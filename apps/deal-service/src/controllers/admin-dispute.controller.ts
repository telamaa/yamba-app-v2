/**
 * admin-dispute.controller.ts — GET /admin/disputes, GET /admin/disputes/:id (C-PR1)
 * ==================================================================================
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ArbitrationQueueQuerySchema, ObjectIdSchema } from "@packages/api-contracts";
import { CSV_BOM, buildCsv, csvFilename } from "@packages/libs/csv";
import { recordAdminAction } from "@packages/admin-audit";
import prisma from "@packages/libs/prisma";
import { ARBITRATION_CSV_COLUMNS } from "../services/admin-dispute.service";
import type { AdminDisputeService } from "../services/admin-dispute.service";

export function makeAdminDisputeController(service: AdminDisputeService) {
  return {
    async listQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const q = ArbitrationQueueQuerySchema.safeParse(req.query); // C-PR7a (D60 2A)
        if (!q.success) throw new ValidationError("Invalid query.");
        res.status(200).json(await service.listQueue(q.data));
      } catch (e) {
        next(e);
      }
    },
    /** C-PR7a (D60 2A) — export CSV opérationnel de la file (ids des parties), journalisé. */
    async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const q = ArbitrationQueueQuerySchema.safeParse(req.query);
        if (!q.success) throw new ValidationError("Invalid query.");
        const now = new Date();
        const rows = await service.exportRows(q.data, now);
        await recordAdminAction(prisma, { adminUserId: req.user.id, action: "EXPORTED", targetType: "BOOKING", after: { domain: "arbitration", personal: false, filters: q.data, rows: rows.length }, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${csvFilename("a-arbitrer", now)}"`);
        res.setHeader("X-Row-Count", String(rows.length));
        res.status(200).send(CSV_BOM + buildCsv(ARBITRATION_CSV_COLUMNS, rows));
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
