/**
 * account.controller.ts — sessions, sudo, identifiants du membre (D65, solde D27)
 * ===============================================================================
 * POST /auth/me/sudo/verify · GET /auth/me/sudo · GET /auth/me/sessions · DELETE /auth/me/sessions[/:jti]
 * POST /auth/me/password · POST /auth/me/email/request · POST /auth/me/email/confirm
 */
import type { NextFunction, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { ChangePasswordRequestSchema, ConfirmEmailChangeSchema, EMAIL_CHANGE_TTL_MINUTES, RequestEmailChangeSchema, SudoVerifyRequestSchema, resolveLocale, type MemberSessionsResponse } from "@packages/api-contracts";
import { AuthError, ConflictError, ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { checkEmailChangeOtpRestrictions, normalizeEmail, revokeRefreshJti, sendEmailChangeOtp, sendPasswordChangedEmail, trackEmailChangeOtpRequests, verifyEmailChangeOtp, verifySudoOtp, type SessionRecord } from "../utils/auth.helper";
import { validatePasswordStrength } from "../utils/password-rules";
import { closeSudoWindow, currentMemberJti, openSudoWindow, requireSudo, sudoStatus, type SudoStore } from "../utils/sudo";
import { UNKNOWN_DEVICE } from "../utils/session-device";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAuthEmails } from "../emails/auth-emails";
import { clearAuthCookies } from "../utils/cookies/setCookie";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const store = redis as unknown as SudoStore;
const emailChangeKey = (userId: string) => `email_change:${userId}`;

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
/** a***@example.com — jamais l'adresse en clair dans un email envoyé à l'ancienne. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Toutes les autres sessions du membre (changement d'identifiant) — la courante survit. */
export async function revokeOtherSessions(userId: string, keepJti: string | null): Promise<number> {
  let cursor = "0";
  let revoked = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `refresh_jti:${userId}:*`, "COUNT", 100);
    cursor = next;
    const others = keys.filter((k) => k.split(":").pop() !== keepJti);
    if (others.length) {
      await redis.del(...others);
      revoked += others.length;
    }
  } while (cursor !== "0");
  return revoked;
}

/* ── Sudo (D65 1A) ─────────────────────────────────────────────────────── */
export const verifySudo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = SudoVerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const jti = currentMemberJti(req);
    if (!jti) throw new AuthError("No session.");
    const emailKey = req.user.emailNormalized ?? req.user.email.toLowerCase();
    await verifySudoOtp(emailKey, parsed.data.code, req.user.preferredLocale);
    const expiresAt = await openSudoWindow(store, req.user.id, jti);
    return res.status(200).json({ active: true, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    return next(e);
  }
};

export const getSudoStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    return res.status(200).json(await sudoStatus(store, req.user.id, currentMemberJti(req)));
  } catch (e) {
    return next(e);
  }
};

/* ── Sessions (D65 2A) ─────────────────────────────────────────────────── */
export const listMySessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const mine = currentMemberJti(req);
    const items: MemberSessionsResponse["items"] = [];
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `refresh_jti:${req.user.id}:*`, "COUNT", 100);
      cursor = next;
      if (keys.length === 0) continue;
      const values = await redis.mget(...keys);
      keys.forEach((key, i) => {
        const raw = values[i];
        const jti = key.split(":").pop() as string;
        let rec: Partial<SessionRecord> = {};
        try { rec = raw && raw !== "1" ? (JSON.parse(raw) as SessionRecord) : {}; } catch { rec = {}; }
        const createdAt = typeof rec.createdAt === "number" ? rec.createdAt : Date.now();
        items.push({ jti, createdAt: new Date(createdAt).toISOString(), lastActivityAt: new Date(typeof rec.lastActivityAt === "number" ? rec.lastActivityAt : createdAt).toISOString(), rememberMe: rec.rememberMe === true, device: rec.device ?? UNKNOWN_DEVICE, ip: rec.ip ?? null, current: jti === mine });
      });
    } while (cursor !== "0");
    items.sort((a, b) => Number(b.current) - Number(a.current) || b.lastActivityAt.localeCompare(a.lastActivityAt));
    return res.status(200).json({ items });
  } catch (e) {
    return next(e);
  }
};

export const revokeMySession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const jti = String(req.params.jti ?? "");
    if (!/^[a-f0-9]{32}$/.test(jti)) throw new ValidationError("Invalid session id.");
    await revokeRefreshJti(req.user.id, jti);
    await closeSudoWindow(store, req.user.id, jti);
    const isCurrent = jti === currentMemberJti(req);
    if (isCurrent) clearAuthCookies(res);
    return res.status(200).json({ ok: true, current: isCurrent });
  } catch (e) {
    return next(e);
  }
};

export const revokeMyOtherSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const revoked = await revokeOtherSessions(req.user.id, currentMemberJti(req));
    return res.status(200).json({ ok: true, revoked });
  } catch (e) {
    return next(e);
  }
};

/* ── Mot de passe (D65 3A) ─────────────────────────────────────────────── */
export const changeMyPassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const jti = await requireSudo(req, store);
    const parsed = ChangePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const { newPassword } = parsed.data;
    validatePasswordStrength(newPassword, { email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName });
    if (req.user.passwordHash && (await bcrypt.compare(newPassword, req.user.passwordHash))) throw new ValidationError("Choose a password different from the current one.", { type: "password", code: "PASSWORD_SAME_AS_CURRENT" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    const revoked = await revokeOtherSessions(req.user.id, jti);
    await closeSudoWindow(store, req.user.id, jti);
    const locale = resolveLocale(req.user.preferredLocale);
    await sendPasswordChangedEmail(req.user.firstName, req.user.emailNormalized ?? req.user.email.toLowerCase(), locale, { changedAt: new Date().toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris" }), ip: req.ip ?? undefined, userAgent: (req.headers["user-agent"] as string | undefined) ?? undefined, securityUrl: `${FRONTEND_URL}/${locale}/dashboard/security` }).catch(() => undefined);
    return res.status(200).json({ ok: true, revokedSessions: revoked, hadPassword: !!req.user.passwordHash });
  } catch (e) {
    return next(e);
  }
};

/* ── Email (D65 4A) ────────────────────────────────────────────────────── */
export const requestEmailChange = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    await requireSudo(req, store);
    const parsed = RequestEmailChangeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const newEmailKey = normalizeEmail(parsed.data.newEmail);
    if (newEmailKey === (req.user.emailNormalized ?? req.user.email.toLowerCase())) throw new ValidationError("This is already your address.", { type: "email", code: "EMAIL_SAME" });
    const taken = await prisma.user.findUnique({ where: { emailNormalized: newEmailKey }, select: { id: true } });
    if (taken) throw new ConflictError("This address is already used by another account.");
    await checkEmailChangeOtpRestrictions(newEmailKey);
    await trackEmailChangeOtpRequests(newEmailKey);
    await redis.set(emailChangeKey(req.user.id), newEmailKey, "EX", EMAIL_CHANGE_TTL_MINUTES * 60);
    await sendEmailChangeOtp(req.user.firstName, newEmailKey, req.user.preferredLocale);
    return res.status(200).json({ ok: true, pendingEmail: maskEmail(newEmailKey), expiresInMinutes: EMAIL_CHANGE_TTL_MINUTES });
  } catch (e) {
    return next(e);
  }
};

export const confirmEmailChange = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));
    const parsed = ConfirmEmailChangeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const newEmailKey = await redis.get(emailChangeKey(req.user.id));
    if (!newEmailKey) throw new ValidationError("No pending email change (or it expired): request a new code.", { type: "email", code: "EMAIL_CHANGE_EXPIRED" });
    await verifyEmailChangeOtp(newEmailKey, parsed.data.code, req.user.preferredLocale);
    const taken = await prisma.user.findUnique({ where: { emailNormalized: newEmailKey }, select: { id: true } });
    if (taken) throw new ConflictError("This address is already used by another account.");
    const oldEmail = req.user.email;
    await prisma.user.update({ where: { id: req.user.id }, data: { email: newEmailKey, emailNormalized: newEmailKey, emailSuppressedAt: null, emailSuppressedReason: null } });
    await redis.del(emailChangeKey(req.user.id));
    const jti = currentMemberJti(req);
    const revoked = await revokeOtherSessions(req.user.id, jti);
    if (jti) await closeSudoWindow(store, req.user.id, jti);
    const locale = resolveLocale(req.user.preferredLocale);
    await sendAuthEmail(oldEmail, locale, getAuthEmails(locale).emailChanged({ firstName: req.user.firstName, newEmailMasked: maskEmail(newEmailKey), supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
    return res.status(200).json({ ok: true, email: newEmailKey, revokedSessions: revoked });
  } catch (e) {
    return next(e);
  }
};
