/**
 * deal-settlement.controller.ts — POST /deals/:id/confirm · /deals/:id/dispute (B4-PR1)
 * ======================================================================================
 * Mince par construction (pattern deal-transport.controller) : valider
 * avec les MÊMES schémas Zod que l'OAS (D3), déléguer, répondre.
 */

import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { DisputeDealRequestSchema, ObjectIdSchema } from "@packages/api-contracts";
import type { DealSettlementService } from "../services/deal-settlement.service";

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

export function makeDealSettlementController(service: DealSettlementService) {
  return {
    async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        res.status(200).json(await service.confirmEarly({ id: req.user.id }, dealId));
      } catch (e) {
        next(e);
      }
    },

    async dispute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = DisputeDealRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.dispute({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
