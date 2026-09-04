/**
 * admin-users.controller.ts — utilisateurs, suspension (C-PR3, D56)
 * ==================================================================
 * GET  /admin/users?q=            (users.read)
 * GET  /admin/users/:id           (users.read) — journalisé USER_VIEWED
 * POST /admin/users/:id/suspension/propose (users.suspension.propose) — SUPPORT propose
 * POST /admin/users/:id/suspension          (users.suspension.apply)   — MEDIATOR / SUPER_ADMIN exécute
 * DELETE /admin/users/:id/suspension        (users.suspension.apply)   — levée
 * Effets d'une SUSPENSION : sessions révoquées, connexion refusée (middleware),
 * trajets masqués de la recherche (filtre côté trip-service), email au membre,
 * email au support avec les deals en cours. RESTRICTED : ni publier ni réserver.
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ApplySuspensionRequestSchema, LiftSuspensionRequestSchema, ObjectIdSchema, ProposeSuspensionRequestSchema, resolveLocale } from "@packages/api-contracts";
import { revokeRefreshJti } from "../utils/auth.helper";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAdminEmails } from "../emails/admin-emails";
import type { AdminUsersService } from "../services/admin-users.service";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function parseId(raw: unknown): string {
  const p = ObjectIdSchema.safeParse(raw);
  if (!p.success) throw new ValidationError("Invalid user id.");
  return p.data;
}
function meta(req: AuthenticatedRequest) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function fmtDate(d: Date | null, locale: string): string | null {
  return d ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d) : null;
}

export function makeAdminUsersController(service: AdminUsersService) {
  async function loadTarget(req: AuthenticatedRequest) {
    const userId = parseId(req.params.id);
    if (userId === req.user.id) throw new ForbiddenError("You cannot act on your own account.");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");
    // Un admin ne se sanctionne pas entre pairs sans le super admin.
    if (user.adminRole && req.adminRole !== "SUPER_ADMIN") throw new ForbiddenError("Only a super administrator can act on an admin account.");
    return user;
  }

  async function notifySupportOfActiveDeals(user: { id: string; firstName: string; lastName: string; email: string }, level: string) {
    const deals = await service.activeDeals(user.id);
    if (deals.length === 0 || !isEmailConfigured()) return;
    await sendTransactionalEmail({
      to: SUPPORT_EMAIL,
      locale: "fr",
      subject: `[Yamba ops] ${level} : ${user.firstName} ${user.lastName} a ${deals.length} deal(s) en cours`,
      content: {
        preheader: `${deals.length} deal(s) en cours à arbitrer`,
        title: `Compte ${level.toLowerCase()} avec des deals en cours`,
        greeting: "Bonjour,",
        paragraphs: [
          `${user.firstName} ${user.lastName} (${user.email}) vient d'être ${level === "SUSPENDED" ? "suspendu" : "restreint"}. Deals en cours à arbitrer :`,
          ...deals.map((d) => `• ${d.id} — ${d.status} — ${d.trip.originCity} → ${d.trip.destinationCity}${d.disputeTicket ? ` — ${d.disputeTicket}` : ""}`),
        ],
        reason: "Récapitulatif ops (C-PR3, D56).",
      },
    }).catch(() => undefined);
  }

  return {
    async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.search(typeof req.query.q === "string" ? req.query.q : ""));
      } catch (e) {
        next(e);
      }
    },

    async getFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const userId = parseId(req.params.id);
        const file = await service.getFile(req.user.id, userId);
        await recordAdminAction(prisma, { adminUserId: req.user.id, action: "USER_VIEWED", targetType: "USER", targetId: userId, ...meta(req) });
        res.status(200).json(file);
      } catch (e) {
        next(e);
      }
    },

    async propose(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const user = await loadTarget(req);
        const parsed = ProposeSuspensionRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { suspensionProposedLevel: parsed.data.level, suspensionProposedReason: parsed.data.reason, suspensionProposedByAdminId: req.user.id, suspensionProposedAt: now },
          });
          await recordAdminAction(tx, { adminUserId: req.user.id, action: "USER_SUSPENSION_PROPOSED", targetType: "USER", targetId: user.id, after: { level: parsed.data.level, reason: parsed.data.reason }, ...meta(req) });
        });
        res.status(200).json({ ok: true, proposedAt: now.toISOString() });
      } catch (e) {
        next(e);
      }
    },

    async apply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const user = await loadTarget(req);
        const parsed = ApplySuspensionRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        const { level, reason } = parsed.data;
        const until = parsed.data.until ? new Date(parsed.data.until) : null;
        if (until && until.getTime() <= Date.now()) throw new ValidationError("The end date must be in the future.");
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: {
              accountStatus: level,
              suspensionReason: reason,
              suspensionUntil: until,
              suspendedAt: now,
              suspendedByAdminId: req.user.id,
              suspensionProposedLevel: null,
              suspensionProposedReason: null,
              suspensionProposedByAdminId: null,
              suspensionProposedAt: null,
            },
          });
          await recordAdminAction(tx, {
            adminUserId: req.user.id,
            action: level === "SUSPENDED" ? "USER_SUSPENDED" : "USER_RESTRICTED",
            targetType: "USER",
            targetId: user.id,
            before: { accountStatus: user.accountStatus },
            after: { accountStatus: level, reason, until: until?.toISOString() ?? null },
            ...meta(req),
          });
        });
        // Effets hors transaction (idempotents) : sessions, emails.
        if (level === "SUSPENDED") await revokeRefreshJti(user.id);
        const locale = resolveLocale(user.preferredLocale);
        const dict = getAdminEmails(locale);
        const params = { firstName: user.firstName, reason, until: fmtDate(until, locale), supportEmail: SUPPORT_EMAIL };
        await sendAuthEmail(user.email, locale, level === "SUSPENDED" ? dict.accountSuspended(params) : dict.accountRestricted(params)).catch(() => undefined);
        await notifySupportOfActiveDeals(user, level);
        res.status(200).json({ ok: true, accountStatus: level, at: now.toISOString() });
      } catch (e) {
        next(e);
      }
    },

    async lift(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const user = await loadTarget(req);
        const parsed = LiftSuspensionRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        if (user.accountStatus === "ACTIVE") throw new ValidationError("This account is not restricted.");
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { accountStatus: "ACTIVE", suspensionReason: null, suspensionUntil: null, suspendedAt: null, suspendedByAdminId: null },
          });
          await recordAdminAction(tx, { adminUserId: req.user.id, action: "USER_REINSTATED", targetType: "USER", targetId: user.id, before: { accountStatus: user.accountStatus }, after: { accountStatus: "ACTIVE", reason: parsed.data.reason }, ...meta(req) });
        });
        const locale = resolveLocale(user.preferredLocale);
        await sendAuthEmail(user.email, locale, getAdminEmails(locale).accountReinstated({ firstName: user.firstName, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
        res.status(200).json({ ok: true, accountStatus: "ACTIVE" });
      } catch (e) {
        next(e);
      }
    },
  };
}
