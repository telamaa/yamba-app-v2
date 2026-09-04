/**
 * deal-mediation.controller.ts — version du Voyageur + décisions admin (C-PR2, D55)
 * ===================================================================================
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import {
  AdminResolveDisputeRequestSchema,
  AdminResolveRetentionRequestSchema,
  CarrierDisputeStatementRequestSchema,
  ObjectIdSchema,
} from "@packages/api-contracts";
import type { DealMediationService } from "../services/deal-mediation.service";

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
function adminActor(req: AuthenticatedRequest) {
  return { id: req.user.id as string, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export function makeDealMediationController(service: DealMediationService) {
  return {
    async respond(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = CarrierDisputeStatementRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(201).json(await service.respond({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async resolveDispute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = AdminResolveDisputeRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.resolveDispute(adminActor(req), dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async resolveRetention(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = AdminResolveRetentionRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.resolveRetention(adminActor(req), dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
