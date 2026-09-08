/**
 * admin-auth.controller.ts — connexion ADMIN en deux temps (D54, 8A)
 * ===================================================================
 * 1. POST /auth/admin/login {email, password}
 *    → compte ADMIN + mot de passe OK → cookie `admin_preauth` (5 min) et
 *      `{ next: "TOTP" }` (2FA active) ou `{ next: "SETUP" }` (première fois).
 *      AUCUNE session n'est ouverte à ce stade.
 * 2a. POST /auth/admin/totp/setup   (pré-auth, 2FA inactive) → secret + URL otpauth
 *     POST /auth/admin/totp/enable  (pré-auth, code) → 2FA active + codes de
 *     secours (montrés UNE fois) + session admin ouverte.
 * 2b. POST /auth/admin/totp/verify  (pré-auth, code TOTP ou code de secours)
 *     → session admin ouverte.
 * Puis POST /auth/admin/refresh · POST /auth/admin/logout · GET /admin/me ·
 * GET /admin/audit.
 *
 * Chaque ouverture de session, activation de 2FA, usage d'un code de secours
 * et déconnexion est journalisée (@packages/admin-audit) dans la MÊME
 * transaction que l'écriture qui l'accompagne.
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import { adminRolesOf } from "../utils/admin-roles";
import { AuthError, ForbiddenError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import {
  consumeBackupCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  isBackupCodeFormat,
  otpauthUrl,
  verifyTotp,
} from "@packages/totp";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { createRefreshJti, normalizeEmail } from "../utils/auth.helper";
import redis from "@packages/libs/redis";
import { resolveLocale } from "@packages/api-contracts";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAdminEmails } from "../emails/admin-emails";
import { adminRemainingLifetimeMs, loadAdminSessionPolicy } from "../utils/admin-session-policy";
import {
  clearTotpFailures,
  getAdminSession,
  registerTotpFailure,
  revokeAdminSession,
  storeAdminSession,
  totpFailuresExceeded,
} from "../utils/admin-session";
import { appliedAuditFilters, buildAuditWhere } from "../lib/admin-audit.query"; // A149
import {
  ADMIN_PREAUTH_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminPreauthCookie,
  setAdminSessionCookies,
} from "../utils/cookies/adminCookies";
import { comparePasswordConstantTime } from "../utils/password-timing";

const TOTP_ISSUER = process.env.ADMIN_TOTP_ISSUER || "Yamba Admin";
const ADMIN_UI_URL = (process.env.ADMIN_UI_URL || "http://localhost:3001").replace(/\/$/, "");
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";

/** C-PR3 (D56 6A) — alerte à chaque ouverture de session admin (best-effort). */
async function sendLoginAlert(req: Request, user: { firstName: string; email: string; preferredLocale: string }): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const at = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  await sendAuthEmail(
    user.email,
    locale,
    getAdminEmails(locale).adminLoginAlert({
      firstName: user.firstName,
      at,
      ip: req.ip ?? "?",
      userAgent: String(req.headers["user-agent"] ?? "?").slice(0, 120),
      sessionsUrl: `${ADMIN_UI_URL}/sessions`,
      supportEmail: SUPPORT_EMAIL,
    })
  ).catch(() => undefined);
}

type PreauthPayload = { id: string; stage: "admin-preauth" };
type AdminRefreshPayload = { id: string; jti: string; adm: true; sca: number };

function clientMeta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

/** Lit et vérifie le cookie de pré-authentification ; charge l'utilisateur ADMIN. */
async function requirePreauth(req: Request) {
  const token = req.cookies?.[ADMIN_PREAUTH_COOKIE];
  if (!token) throw new AuthError("Admin pre-authentication required.", { code: "ADMIN_PREAUTH_REQUIRED" });
  let decoded: PreauthPayload;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as PreauthPayload;
  } catch {
    throw new AuthError("Admin pre-authentication expired.", { code: "ADMIN_PREAUTH_EXPIRED" });
  }
  if (decoded?.stage !== "admin-preauth" || !decoded.id) throw new AuthError("Admin pre-authentication invalid.", { code: "ADMIN_PREAUTH_INVALID" });
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.isDeleted || !user.roles.includes("ADMIN") || !user.adminRole) throw new ForbiddenError("Not an admin account.", { code: "NOT_AN_ADMIN" });
  return user;
}

/** Ouvre la session admin : cookies + record Redis + JWT porteur de `amr: ["pwd","totp"]`. */
async function issueAdminSession(res: Response, user: { id: string; roles: string[] }): Promise<void> {
  const createdAt = Date.now();
  const jti = createRefreshJti();
  const ttl = await storeAdminSession(user.id, jti, createdAt, createdAt);
  if (ttl <= 0) throw new AuthError("Admin session could not be opened.", { code: "ADMIN_SESSION_FAILED" });
  const accessToken = jwt.sign(
    { id: user.id, roles: user.roles, adm: true, amr: ["pwd", "totp"], adminRole: (user as { adminRole?: string | null }).adminRole ?? null, adminRoles: adminRolesOf(user as { adminRole?: string | null; adminRoles?: string[] | null }) },
    process.env.ACCESS_TOKEN_SECRET as string,
    { expiresIn: "15m" }
  );
  const lifetimeSeconds = Math.ceil(adminRemainingLifetimeMs(createdAt, loadAdminSessionPolicy(), createdAt) / 1000);
  const refreshToken = jwt.sign(
    { id: user.id, jti, adm: true, sca: createdAt } satisfies AdminRefreshPayload,
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: lifetimeSeconds }
  );
  setAdminSessionCookies(res, accessToken, refreshToken, lifetimeSeconds * 1000);
}

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return next(new ValidationError("Email and password are required!", { code: "MISSING_FIELDS" }));
    const user = await prisma.user.findUnique({ where: { emailNormalized: normalizeEmail(String(email)) } });
    // Même message pour « inconnu », « pas admin » et « mauvais mot de passe » : ne rien révéler.
    // ANO-API-18 — même raison qu'à la connexion membre, et l'enjeu est ici plus grand : une
    // porte d'administration ne doit pas laisser deviner QUI est administrateur. Le hachage
    // est comparé dans tous les cas, y compris pour un compte absent ou sans profil admin.
    const eligible = Boolean(user && !user.isDeleted && user.roles.includes("ADMIN") && user.adminRole);
    const ok = await comparePasswordConstantTime(String(password), eligible ? user?.passwordHash : null);
    if (!eligible || !user) return next(new AuthError("Invalid email or password", { code: "INVALID_CREDENTIALS" }));
    if (!user.passwordHash) return next(new AuthError("Set your password with the invitation link first.", { code: "PASSWORD_NOT_SET" }));
    if (!ok) return next(new AuthError("Invalid email or password", { code: "INVALID_CREDENTIALS" }));

    const policy = loadAdminSessionPolicy();
    const preauth = jwt.sign({ id: user.id, stage: "admin-preauth" } satisfies PreauthPayload, process.env.ACCESS_TOKEN_SECRET as string, {
      expiresIn: `${policy.preauthMinutes}m`,
    });
    clearAdminCookies(res);
    setAdminPreauthCookie(res, preauth, policy.preauthMinutes * 60 * 1000);
    return res.status(200).json({ next: user.totpEnabledAt ? "TOTP" : "SETUP" });
  } catch (e) {
    return next(e);
  }
};

export const adminTotpSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await requirePreauth(req);
    if (user.totpEnabledAt) return next(new ForbiddenError("Two-factor authentication is already enabled.", { code: "TOTP_ALREADY_ENABLED" }));
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecretEncrypted: encryptTotpSecret(secret) } });
    return res.status(200).json({ secret, otpauthUrl: otpauthUrl({ issuer: TOTP_ISSUER, account: user.email, secret }) });
  } catch (e) {
    return next(e);
  }
};

export const adminTotpEnable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await requirePreauth(req);
    if (user.totpEnabledAt) return next(new ForbiddenError("Two-factor authentication is already enabled.", { code: "TOTP_ALREADY_ENABLED" }));
    if (!user.totpSecretEncrypted) return next(new ValidationError("Run the setup first.", { code: "TOTP_SETUP_REQUIRED" }));
    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (!secret) return next(new AuthError("Stored secret unreadable — run the setup again.", { code: "TOTP_SECRET_UNREADABLE" }));
    const { code } = req.body as { code?: string };
    const verdict = verifyTotp(secret, String(code ?? ""));
    if (!verdict.ok) return next(new AuthError("Invalid code.", { code: "OTP_INCORRECT" }));

    const backupCodes = generateBackupCodes();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { totpEnabledAt: new Date(), totpLastUsedStep: verdict.step, totpBackupCodeHashes: backupCodes.map(hashBackupCode) },
      });
      await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_TOTP_ENABLED", targetType: "USER", targetId: user.id, ...clientMeta(req) });
      await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_LOGIN", targetType: "SESSION", after: { method: "totp-setup" }, ...clientMeta(req) });
    });
    await issueAdminSession(res, user);
    await sendLoginAlert(req, user);
    return res.status(200).json({ ok: true, backupCodes });
  } catch (e) {
    return next(e);
  }
};

export const adminTotpVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await requirePreauth(req);
    if (!user.totpEnabledAt || !user.totpSecretEncrypted) return next(new ForbiddenError("Two-factor authentication is not enabled.", { code: "TOTP_NOT_ENABLED" }));
    if (await totpFailuresExceeded(user.id)) return next(new AuthError("Too many attempts. Try again in 15 minutes.", { code: "TOO_MANY_ATTEMPTS" }));
    const { code } = req.body as { code?: string };
    const raw = String(code ?? "").trim();

    let usedBackup = false;
    let remainingBackupCodes = user.totpBackupCodeHashes.length;
    if (/^\d{6}$/.test(raw.replace(/\s+/g, ""))) {
      const secret = decryptTotpSecret(user.totpSecretEncrypted);
      if (!secret) return next(new AuthError("Stored secret unreadable.", { code: "TOTP_SECRET_UNREADABLE" }));
      const verdict = verifyTotp(secret, raw, { lastUsedStep: user.totpLastUsedStep });
      if (!verdict.ok) {
        await registerTotpFailure(user.id);
        return next(new AuthError("Invalid code.", { code: "OTP_INCORRECT" }));
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { totpLastUsedStep: verdict.step } });
        await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_LOGIN", targetType: "SESSION", after: { method: "totp" }, ...clientMeta(req) });
      });
    } else if (isBackupCodeFormat(raw)) {
      const remaining = consumeBackupCode(raw, user.totpBackupCodeHashes);
      if (!remaining) {
        await registerTotpFailure(user.id);
        return next(new AuthError("Invalid code.", { code: "OTP_INCORRECT" }));
      }
      usedBackup = true;
      remainingBackupCodes = remaining.length;
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { totpBackupCodeHashes: remaining } });
        await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_BACKUP_CODE_USED", targetType: "USER", targetId: user.id, after: { remaining: remaining.length }, ...clientMeta(req) });
        await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_LOGIN", targetType: "SESSION", after: { method: "backup-code" }, ...clientMeta(req) });
      });
    } else {
      await registerTotpFailure(user.id);
      return next(new AuthError("Invalid code.", { code: "OTP_INCORRECT" }));
    }

    await clearTotpFailures(user.id);
    await issueAdminSession(res, user);
    await sendLoginAlert(req, user);
    return res.status(200).json({ ok: true, usedBackupCode: usedBackup, remainingBackupCodes });
  } catch (e) {
    return next(e);
  }
};

export const adminRefresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (!token) return next(new AuthError("Admin refresh token missing.", { code: "ADMIN_REFRESH_MISSING" }));
    let decoded: AdminRefreshPayload;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as AdminRefreshPayload;
    } catch {
      clearAdminCookies(res);
      return next(new AuthError("Admin refresh token invalid or expired.", { code: "ADMIN_REFRESH_INVALID" }));
    }
    if (!decoded?.adm || !decoded.id || !decoded.jti) {
      clearAdminCookies(res);
      return next(new AuthError("Admin refresh token invalid.", { code: "ADMIN_REFRESH_INVALID" }));
    }
    const session = await getAdminSession(decoded.id, decoded.jti);
    if (!session) {
      clearAdminCookies(res);
      return next(new AuthError("Admin session expired.", { code: "ADMIN_SESSION_EXPIRED" }));
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isDeleted || !user.roles.includes("ADMIN") || !user.totpEnabledAt) {
      clearAdminCookies(res);
      return next(new ForbiddenError("Not an admin account.", { code: "NOT_AN_ADMIN" }));
    }
    // Rotation : nouveau jti, MÊME createdAt (c'est lui qui borne la vie absolue).
    const now = Date.now();
    const newJti = createRefreshJti();
    const ttl = await storeAdminSession(user.id, newJti, session.createdAt, now);
    await revokeAdminSession(user.id, decoded.jti);
    if (ttl <= 0) {
      clearAdminCookies(res);
      return next(new AuthError("Admin session expired.", { code: "ADMIN_SESSION_EXPIRED" }));
    }
    const accessToken = jwt.sign({ id: user.id, roles: user.roles, adm: true, amr: ["pwd", "totp"] }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" });
    const lifetimeSeconds = Math.ceil(adminRemainingLifetimeMs(session.createdAt, loadAdminSessionPolicy(), now) / 1000);
    const refreshToken = jwt.sign({ id: user.id, jti: newJti, adm: true, sca: session.createdAt } satisfies AdminRefreshPayload, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: lifetimeSeconds });
    setAdminSessionCookies(res, accessToken, refreshToken, lifetimeSeconds * 1000);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return next(e);
  }
};

export const adminLogout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as AdminRefreshPayload;
        if (decoded?.id && decoded?.jti) {
          await revokeAdminSession(decoded.id, decoded.jti);
          await recordAdminAction(prisma, { adminUserId: decoded.id, action: "ADMIN_LOGOUT", targetType: "SESSION", ...clientMeta(req) });
        }
      } catch {
        // jeton invalide ou expiré : on nettoie quand même
      }
    }
    clearAdminCookies(res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return next(e);
  }
};

export const getAdminMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const u = req.user;
    return res.status(200).json({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      adminRole: u.adminRole ?? null,
      adminRoles: adminRolesOf(u), // C-PR3bis (D60 1A)
      remainingBackupCodes: (u.totpBackupCodeHashes ?? []).length,
    });
  } catch (e) {
    return next(e);
  }
};

const AUDIT_PAGE = 50;

export const listAdminAudit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cursor = typeof req.query.cursor === "string" && /^[a-f0-9]{24}$/.test(req.query.cursor) ? req.query.cursor : undefined;
    // A149 — filtres du journal : période, auteur, action, cible, IP (règle pure, valeur mal formée ignorée).
    const q = req.query as Record<string, string | undefined>;
    const where = buildAuditWhere({ from: q.from, to: q.to, adminUserId: q.adminUserId, action: q.action, targetType: q.targetType, targetId: q.targetId, ip: q.ip });
    const rows = await prisma.adminAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: AUDIT_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, AUDIT_PAGE);
    const adminIds = [...new Set(page.map((r) => r.adminUserId))];
    const admins = adminIds.length ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const byId = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName.charAt(0)}.`]));
    return res.status(200).json({
      items: page.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        admin: byId.get(r.adminUserId) ?? r.adminUserId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        before: r.before,
        after: r.after,
        ip: r.ip,
      })),
      nextCursor: rows.length > AUDIT_PAGE ? page[page.length - 1].id : null,
      appliedFilters: appliedAuditFilters({ from: q.from, to: q.to, adminUserId: q.adminUserId, action: q.action, targetType: q.targetType, targetId: q.targetId, ip: q.ip }),
    });
  } catch (e) {
    return next(e);
  }
};

/* ── C-PR3 (D56 6A) — sessions admin : liste et révocation ─────────────── */

function currentJti(req: Request): string | null {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
  if (!token) return null;
  try {
    return (jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as AdminRefreshPayload).jti ?? null;
  } catch {
    return null;
  }
}

export const listAdminSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mine = currentJti(req);
    const items: Array<{ jti: string; createdAt: string; lastActivityAt: string; current: boolean }> = [];
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `admin_jti:${req.user.id}:*`, "COUNT", 100);
      cursor = nextCursor;
      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        try {
          const rec = JSON.parse(raw) as { createdAt: number; lastActivityAt: number };
          const jti = key.split(":").pop() as string;
          items.push({ jti, createdAt: new Date(rec.createdAt).toISOString(), lastActivityAt: new Date(rec.lastActivityAt).toISOString(), current: jti === mine });
        } catch {
          // record illisible : ignoré
        }
      }
    } while (cursor !== "0");
    items.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return res.status(200).json({ items });
  } catch (e) {
    return next(e);
  }
};

export const revokeAdminSessionById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const jti = String(req.params.jti ?? "");
    if (!/^[a-f0-9]{32}$/.test(jti)) return res.status(400).json({ message: "Invalid session id." });
    await revokeAdminSession(req.user.id, jti);
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "ADMIN_SESSION_REVOKED", targetType: "SESSION", targetId: jti, ...clientMeta(req) });
    if (jti === currentJti(req)) clearAdminCookies(res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return next(e);
  }
};
