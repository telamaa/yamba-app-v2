/**
 * deal-request.controller.ts — POST /deals/payment-intents · POST /deals (B2)
 * ==========================================================================
 * Mince par construction : valider (Zod, les mêmes schémas que l'OAS — D3),
 * déléguer au service, répondre. Aucune règle métier ici.
 */

import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { CreateBookingRequestSchema, CreatePaymentIntentRequestSchema } from "@packages/api-contracts";
import type { DealRequestService } from "../services/deal-request.service";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

export function makeDealRequestController(service: DealRequestService) {
  return {
    async createPaymentIntent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = CreatePaymentIntentRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const result = await service.createPaymentIntent({ id: req.user.id, email: req.user.email }, parsed.data);
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    },

    async createBooking(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = CreateBookingRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const result = await service.createBooking({ id: req.user.id, email: req.user.email }, parsed.data);
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    },
  };
}
