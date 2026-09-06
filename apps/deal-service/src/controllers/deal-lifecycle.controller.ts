/**
 * deal-lifecycle.controller.ts — POST /deals/:id/accept · /decline · /cancel (B2-PR2)
 * ===================================================================================
 * Mince par construction : valider (Zod, les mêmes schémas que l'OAS — D3),
 * déléguer au service, répondre. Aucune règle métier ici — la machine et le
 * service décident (jamais un controller).
 */

import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import {
  AcceptDealRequestSchema,
  CancelDealRequestSchema,
  DeclineDealRequestSchema,
  ObjectIdSchema,
} from "@packages/api-contracts";
import type { DealLifecycleService } from "../services/deal-lifecycle.service";

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

export function makeDealLifecycleController(service: DealLifecycleService) {
  return {
    async accept(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = AcceptDealRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const result = await service.accept({ id: req.user.id }, dealId, parsed.data);
        res.status(200).json(result);
      } catch (e) {
        next(e);
      }
    },

    async decline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = DeclineDealRequestSchema.safeParse(req.body ?? {});
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const result = await service.decline({ id: req.user.id }, dealId, parsed.data);
        res.status(200).json(result);
      } catch (e) {
        next(e);
      }
    },

    async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = CancelDealRequestSchema.safeParse(req.body ?? {});
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const result = await service.cancel({ id: req.user.id }, dealId, parsed.data);
        res.status(200).json(result);
      } catch (e) {
        next(e);
      }
    },
  };
}
