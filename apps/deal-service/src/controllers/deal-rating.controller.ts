/**
 * deal-rating.controller.ts — GET/POST /deals/:id/rating (B5)
 * ===========================================================
 * Mince : valider avec le schéma Zod de l'OAS, déléguer, répondre.
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ObjectIdSchema, SubmitRatingRequestSchema } from "@packages/api-contracts";
import type { DealRatingService } from "../services/deal-rating.service";

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

export function makeDealRatingController(service: DealRatingService) {
  return {
    async getContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.getContext({ id: req.user.id }, parseDealId(req.params.id)));
      } catch (e) {
        next(e);
      }
    },
    async submit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const dealId = parseDealId(req.params.id);
        const parsed = SubmitRatingRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(201).json(await service.submit({ id: req.user.id }, dealId, parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
