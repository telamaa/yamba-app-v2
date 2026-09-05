/**
 * privacy.controller.ts — les droits sur les données, côté membre et côté admin (C-PR8b, D63)
 * ============================================================================================
 * Membre : POST /auth/me/sudo/request (code par email) · POST /auth/me/data-export { code } (JSON)
 *          GET /auth/me/erasure/blockers · POST /auth/me/erasure { code, confirmation } · PATCH /auth/me/preferences
 * Admin  : POST /admin/users/:id/erase { reason } (PRIVACY / SUPER_ADMIN) · GET /admin/privacy/requests
 */
import type { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import {
  AdminEraseUserRequestSchema,
  DATA_EXPORT_MIN_INTERVAL_HOURS,
  EraseMyAccountRequestSchema,
  ObjectIdSchema,
  UpdateMyPreferencesRequestSchema,
  resolveLocale,
  type DataRequestsResponse,
  type ErasureBlockedResponse,
} from "@packages/api-contracts";
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { deleteImageKitFile } from "@packages/libs/imagekit";
import { checkSudoOtpRestrictions, revokeRefreshJti, sendSudoOtp, trackSudoOtpRequests } from "../utils/auth.helper";
import { requireSudo } from "../utils/sudo";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAuthEmails } from "../emails/auth-emails";
import { ErasureBlockedError, makePrivacyService, type EraseResult, type PrivacyDb } from "../services/privacy.service";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";
const REQUESTS_PAGE = 50;

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
const meta = (req: Request) => ({ ip: req.ip ?? null, userAgent: (req.headers["user-agent"] as string | undefined) ?? null });

/** Après le commit (D63 4A) : sessions, fichiers ImageKit, email à l'ancienne adresse — best effort, tracé. */
async function afterErase(r: EraseResult): Promise<void> {
  await Promise.all([
    revokeRefreshJti(r.userId).catch(() => undefined),
    ...r.fileIds.map((id) => deleteImageKitFile(id).catch((err) => console.warn("[privacy] ImageKit delete failed", id, err instanceof Error ? err.message : err))),
  ]);
  const locale = resolveLocale(r.locale);
  await sendAuthEmail(r.email, locale, getAuthEmails(locale).accountErased({ firstName: r.firstName, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
}

export const privacyService = makePrivacyService({ db: prisma as unknown as PrivacyDb, afterErase });

function blocked(res: Response, e: ErasureBlockedError) {
  const body: ErasureBlockedResponse = { code: "ERASURE_BLOCKED", blockers: e.check.blockers, counts: e.check.counts };
  return res.status(409).json({ message: e.message, ...body });
}

/* ── Membre ─────────────────────────────────────────────────────────────── */

export const requestSudoCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const emailKey = req.user.emailNormalized ?? req.user.email.toLowerCase();
    await checkSudoOtpRestrictions(emailKey);
    await trackSudoOtpRequests(emailKey);
    await sendSudoOtp(req.user.firstName, emailKey, req.user.preferredLocale);
    return res.status(200).json({ success: true, message: "Code sent." });
  } catch (e) {
    return next(e);
  }
};

/** D65 1A — la fenêtre sudo (code vérifié par `POST /auth/me/sudo/verify`) remplace le code dans le corps. */
const assertSudo = (req: AuthenticatedRequest) => requireSudo(req);

export const exportMyData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const last = await privacyService.lastExportAt(req.user.id);
    if (last && Date.now() - last.getTime() < DATA_EXPORT_MIN_INTERVAL_HOURS * 3_600_000) {
      throw new ValidationError(`One export per ${DATA_EXPORT_MIN_INTERVAL_HOURS} hours.`, { code: "EXPORT_RATE_LIMITED", nextAt: new Date(last.getTime() + DATA_EXPORT_MIN_INTERVAL_HOURS * 3_600_000).toISOString() });
    }
    await assertSudo(req);
    const data = await privacyService.buildDataExport(req.user.id);
    await privacyService.recordExport(req.user.id, "MEMBER", meta(req));
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="yamba-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.status(200).send(JSON.stringify(data, null, 2));
  } catch (e) {
    return next(e);
  }
};

export const getMyErasureBlockers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    return res.status(200).json(await privacyService.erasureBlockers(req.user.id));
  } catch (e) {
    return next(e);
  }
};

export const eraseMyAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = EraseMyAccountRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    await assertSudo(req);
    try {
      await privacyService.eraseAccount({ userId: req.user.id, channel: "MEMBER", ...meta(req) });
    } catch (e) {
      if (e instanceof ErasureBlockedError) return blocked(res, e);
      throw e;
    }
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.status(200).json({ success: true, erased: true });
  } catch (e) {
    return next(e);
  }
};

export const updateMyPreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = UpdateMyPreferencesRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const data: Record<string, unknown> = {};
    if (typeof parsed.data.messagingReminderEmails === "boolean") data.messagingReminderEmails = parsed.data.messagingReminderEmails;
    if (Object.keys(data).length === 0) throw new ValidationError("Nothing to update.");
    const user = await prisma.user.update({ where: { id: req.user.id }, data, select: { messagingReminderEmails: true, preferredLocale: true } });
    return res.status(200).json({ success: true, preferences: user });
  } catch (e) {
    return next(e);
  }
};

/* ── Admin (PRIVACY / SUPER_ADMIN) ──────────────────────────────────────── */

export const adminEraseUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid user id.");
    const parsed = AdminEraseUserRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    if (id.data === req.user.id) throw new ForbiddenError("You cannot erase your own account from the back-office.");
    const target = await prisma.user.findUnique({ where: { id: id.data }, select: { id: true, isDeleted: true } });
    if (!target || target.isDeleted) throw new NotFoundError("User not found.");
    try {
      await privacyService.eraseAccount({ userId: id.data, channel: "ADMIN", requestedByAdminId: req.user.id, reason: parsed.data.reason, ...meta(req) });
    } catch (e) {
      if (e instanceof ErasureBlockedError) return blocked(res, e);
      throw e;
    }
    return res.status(200).json({ success: true, erased: true });
  } catch (e) {
    return next(e);
  }
};

export const listDataRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cursor = typeof req.query.cursor === "string" && /^[a-f0-9]{24}$/.test(req.query.cursor) ? req.query.cursor : undefined;
    const rows = await prisma.dataRequest.findMany({ orderBy: { requestedAt: "desc" }, take: REQUESTS_PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const page = rows.slice(0, REQUESTS_PAGE);
    const ids = [...new Set([...page.map((r) => r.userId), ...page.map((r) => r.requestedByAdminId).filter((x): x is string => !!x)])];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, isDeleted: true } }) : [];
    const label = new Map(users.map((u) => [u.id, u.isDeleted ? "Membre supprimé" : `${u.firstName} ${u.lastName.charAt(0)}.`]));
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "DATA_REQUESTS_VIEWED", targetType: "USER", targetId: null, after: { rows: page.length }, ...meta(req) });
    const body: DataRequestsResponse = {
      items: page.map((r) => ({ id: r.id, userId: r.userId, userLabel: label.get(r.userId) ?? "Membre supprimé", type: r.type, channel: r.channel, status: r.status, refusalReasons: r.refusalReasons, requestedByAdmin: r.requestedByAdminId ? label.get(r.requestedByAdminId) ?? r.requestedByAdminId : null, reason: r.reason, requestedAt: r.requestedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null })),
      nextCursor: rows.length > REQUESTS_PAGE ? page[page.length - 1].id : null,
    };
    return res.status(200).json(body);
  } catch (e) {
    return next(e);
  }
};
