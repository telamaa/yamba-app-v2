/**
 * admin-finance.controller.ts — finances côté admin (C-PR5a, D58)
 * ================================================================
 * GET  /admin/finances/queue?kind=FAILED|REVERSED|HELD  (finances.read)
 * GET  /admin/deals/:id/money                            (finances.read) — journalisé DEAL_MONEY_VIEWED
 * POST /admin/deals/:id/money/reconcile                  (finances.read) — lecture fournisseur, journalisé
 * POST /admin/deals/:id/payout/retry                     (payouts.retry)
 * POST /admin/deals/:id/payout/reversal                  (payouts.resolve)
 * GET  /admin/finances/report?months=12                  (finances.read)   — C-PR5b
 * GET  /admin/finances/export?from&to                    (finances.export) — C-PR5b, CSV, journalisé
 * POST /admin/deals/:id/refund/propose                   (refunds.manual.propose) — C-PR5b
 * POST /admin/deals/:id/refund                           (refunds.manual.apply, SUPER_ADMIN) — C-PR5b
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { FinanceQueueKindSchema, ManualRefundRequestSchema, ObjectIdSchema, ResolveReversalRequestSchema } from "@packages/api-contracts";
import type { AdminFinanceService } from "../services/admin-finance.service";

function actor(req: AuthenticatedRequest) {
  return { id: req.user.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function dealId(raw: unknown): string {
  const p = ObjectIdSchema.safeParse(raw);
  if (!p.success) throw new ValidationError("Invalid deal id.");
  return p.data;
}
function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

export function makeAdminFinanceController(service: AdminFinanceService) {
  return {
    async listQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const kind = FinanceQueueKindSchema.safeParse(req.query.kind ?? "FAILED");
        if (!kind.success) throw new ValidationError("Invalid queue kind.");
        res.status(200).json(await service.listQueue(kind.data));
      } catch (e) {
        next(e);
      }
    },
    async getMoneyFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.getMoneyFile(actor(req), dealId(req.params.id)));
      } catch (e) {
        next(e);
      }
    },
    async reconcile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.reconcileDeal(actor(req), dealId(req.params.id)));
      } catch (e) {
        next(e);
      }
    },
    async retryPayout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.retryPayout(actor(req), dealId(req.params.id)));
      } catch (e) {
        next(e);
      }
    },
    async getReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const months = typeof req.query.months === "string" ? Number(req.query.months) : 12;
        if (!Number.isFinite(months) || months < 1 || months > 24) throw new ValidationError("months must be between 1 and 24.");
        res.status(200).json(await service.getReport(months));
      } catch (e) {
        next(e);
      }
    },
    async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(NaN);
        const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date(NaN);
        const out = await service.exportCsv(actor(req), from, to);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
        res.setHeader("X-Row-Count", String(out.rows));
        res.status(200).send("\uFEFF" + out.csv);
      } catch (e) {
        next(e);
      }
    },
    async proposeRefund(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ManualRefundRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.proposeManualRefund(actor(req), dealId(req.params.id), parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async applyRefund(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ManualRefundRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.applyManualRefund(actor(req), dealId(req.params.id), parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async resolveReversal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ResolveReversalRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(200).json(await service.resolveReversal(actor(req), dealId(req.params.id), parsed.data));
      } catch (e) {
        next(e);
      }
    },
  };
}
