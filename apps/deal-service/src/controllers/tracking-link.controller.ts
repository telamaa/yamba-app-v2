/**
 * tracking-link.controller.ts — page destinataire (D69)
 * ======================================================
 *  POST /deals/:id/tracking-link   Expéditeur connecté → { token, path, contact du destinataire }
 *  GET  /track/:token              SANS session → contenu minimal (404 uniforme)
 */
import type { NextFunction, Request, Response } from "express";
import { ObjectIdSchema } from "@packages/api-contracts";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import type { TrackingLinkService } from "../services/tracking-link.service";

export function makeTrackingLinkController(service: TrackingLinkService) {
  return {
    async issue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const id = ObjectIdSchema.safeParse(req.params.id);
        if (!id.success) return next(new ValidationError("Invalid deal id."));
        res.status(200).json(await service.issue(req.user.id, id.data));
      } catch (e) {
        next(e);
      }
    },
    async publicView(req: Request, res: Response, next: NextFunction) {
      try {
        const token = String(req.params.token ?? "");
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return next(new ValidationError("Invalid tracking token."));
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(await service.publicView(token));
      } catch (e) {
        next(e);
      }
    },
  };
}
