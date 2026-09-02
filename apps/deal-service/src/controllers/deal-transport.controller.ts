/**
 * deal-transport.controller.ts — POST /deals/:id/pickup · /pickup/refuse · /events · /code/regenerate · /deliver (B3-PR1)
 * ========================================================================================================================
 * Mince par construction (pattern deal-lifecycle.controller) : valider
 * avec les MÊMES schémas Zod que l'OAS (D3), déléguer, répondre. Aucune
 * règle métier ici.
 */

import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import {
  ConfirmPickupRequestSchema,
  ConfirmTrackingStepRequestSchema,
  DeliverDealRequestSchema,
  ObjectIdSchema,
  RefusePickupRequestSchema,
} from "@packages/api-contracts";
import type { DealTransportService } from "../services/deal-transport.service";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

function parseDealId(raw: unknown): string {
  const parsed = ObjectIdSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid deal id.");
  return parsed.data;
}

export function makeDealTransportController(service: DealTransportService) {
  return {
    async confirmPickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = ConfirmPickupRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.confirmPickup({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },

    async refusePickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = RefusePickupRequestSchema.safeParse(req.body ?? {});
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.refusePickup({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },

    async confirmTrackingStep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = ConfirmTrackingStepRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.confirmTrackingStep({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },

    async regenerateCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        res.status(200).json(await service.regenerateCode({ id: req.user.id }, dealId));
      } catch (e) {
        next(e);
      }
    },

    async deliver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = DeliverDealRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.deliver({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
