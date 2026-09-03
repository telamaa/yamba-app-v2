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
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
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
import { adminRemainingLifetimeMs, loadAdminSessionPolicy } from "../utils/admin-session-policy";
import {
  clearTotpFailures,
  getAdminSession,
  registerTotpFailure,
  revokeAdminSession,
  storeAdminSession,
  totpFailuresExceeded,
} from "../utils/admin-session";
import {
  ADMIN_PREAUTH_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminPreauthCookie,
  setAdminSessionCookies,
} from "../utils/cookies/adminCookies";

const TOTP_ISSUER = process.env.ADMIN_TOTP_ISSUER || "Yamba Admin";

type PreauthPayload = { id: string; stage: "admin-preauth" };
type AdminRefreshPayload = { id: string; jti: string; adm: true; sca: number };

function clientMeta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

/** Lit et vérifie le cookie de pré-authentification ; charge l'utilisateur ADMIN. */
async function requirePreauth(req: Request) {
  const token = req.cookies?.[ADMIN_PREAUTH_COOKIE];
  if (!token) throw new AuthError("Admin pre-authentication required.");
  let decoded: PreauthPayload;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as PreauthPayload;
  } catch {
    throw new AuthError("Admin pre-authentication expired.");
  }
  if (decoded?.stage !== "admin-preauth" || !decoded.id) throw new AuthError("Admin pre-authentication invalid.");
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.isDeleted || !user.roles.includes("ADMIN")) throw new ForbiddenError("Not an admin account.");
  return user;
}

/** Ouvre la session admin : cookies + record Redis + JWT porteur de `amr: ["pwd","totp"]`. */
async function issueAdminSession(res: Response, user: { id: string; roles: string[] }): Promise<void> {
  const createdAt = Date.now();
  const jti = createRefreshJti();
  const ttl = await storeAdminSession(user.id, jti, createdAt, createdAt);
  if (ttl <= 0) throw new AuthError("Admin session could not be opened.");
  const accessToken = jwt.sign(
    { id: user.id, roles: user.roles, adm: true, amr: ["pwd", "totp"] },
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
    if (!email || !password) return next(new ValidationError("Email and password are required!"));
    const user = await prisma.user.findUnique({ where: { emailNormalized: normalizeEmail(String(email)) } });
    // Même message pour « inconnu », « pas admin » et « mauvais mot de passe » : ne rien révéler.
    if (!user || user.isDeleted || !user.roles.includes("ADMIN")) return next(new AuthError("Invalid email or password"));
    const ok = await bcrypt.compare(String(password), user.passwordHash ?? "");
    if (!ok) return next(new AuthError("Invalid email or password"));

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
    if (user.totpEnabledAt) return next(new ForbiddenError("Two-factor authentication is already enabled."));
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
    if (user.totpEnabledAt) return next(new ForbiddenError("Two-factor authentication is already enabled."));
    if (!user.totpSecretEncrypted) return next(new ValidationError("Run the setup first."));
    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (!secret) return next(new AuthError("Stored secret unreadable — run the setup again."));
    const { code } = req.body as { code?: string };
    const verdict = verifyTotp(secret, String(code ?? ""));
    if (!verdict.ok) return next(new AuthError("Invalid code."));

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
    return res.status(200).json({ ok: true, backupCodes });
  } catch (e) {
    return next(e);
  }
};

export const adminTotpVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await requirePreauth(req);
    if (!user.totpEnabledAt || !user.totpSecretEncrypted) return next(new ForbiddenError("Two-factor authentication is not enabled."));
    if (await totpFailuresExceeded(user.id)) return next(new AuthError("Too many attempts. Try again in 15 minutes."));
    const { code } = req.body as { code?: string };
    const raw = String(code ?? "").trim();

    let usedBackup = false;
    let remainingBackupCodes = user.totpBackupCodeHashes.length;
    if (/^\d{6}$/.test(raw.replace(/\s+/g, ""))) {
      const secret = decryptTotpSecret(user.totpSecretEncrypted);
      if (!secret) return next(new AuthError("Stored secret unreadable."));
      const verdict = verifyTotp(secret, raw, { lastUsedStep: user.totpLastUsedStep });
      if (!verdict.ok) {
        await registerTotpFailure(user.id);
        return next(new AuthError("Invalid code."));
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { totpLastUsedStep: verdict.step } });
        await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_LOGIN", targetType: "SESSION", after: { method: "totp" }, ...clientMeta(req) });
      });
    } else if (isBackupCodeFormat(raw)) {
      const remaining = consumeBackupCode(raw, user.totpBackupCodeHashes);
      if (!remaining) {
        await registerTotpFailure(user.id);
        return next(new AuthError("Invalid code."));
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
      return next(new AuthError("Invalid code."));
    }

    await clearTotpFailures(user.id);
    await issueAdminSession(res, user);
    return res.status(200).json({ ok: true, usedBackupCode: usedBackup, remainingBackupCodes });
  } catch (e) {
    return next(e);
  }
};

export const adminRefresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (!token) return next(new AuthError("Admin refresh token missing."));
    let decoded: AdminRefreshPayload;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as AdminRefreshPayload;
    } catch {
      clearAdminCookies(res);
      return next(new AuthError("Admin refresh token invalid or expired."));
    }
    if (!decoded?.adm || !decoded.id || !decoded.jti) {
      clearAdminCookies(res);
      return next(new AuthError("Admin refresh token invalid."));
    }
    const session = await getAdminSession(decoded.id, decoded.jti);
    if (!session) {
      clearAdminCookies(res);
      return next(new AuthError("Admin session expired."));
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isDeleted || !user.roles.includes("ADMIN") || !user.totpEnabledAt) {
      clearAdminCookies(res);
      return next(new ForbiddenError("Not an admin account."));
    }
    // Rotation : nouveau jti, MÊME createdAt (c'est lui qui borne la vie absolue).
    const now = Date.now();
    const newJti = createRefreshJti();
    const ttl = await storeAdminSession(user.id, newJti, session.createdAt, now);
    await revokeAdminSession(user.id, decoded.jti);
    if (ttl <= 0) {
      clearAdminCookies(res);
      return next(new AuthError("Admin session expired."));
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
    const rows = await prisma.adminAction.findMany({
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
    });
  } catch (e) {
    return next(e);
  }
};
