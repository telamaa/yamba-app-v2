/**
 * admin-admins.controller.ts — comptes du back-office (C-PR3, D56 1A + invitation)
 * =================================================================================
 * GET    /admin/admins                  (admins.manage = SUPER_ADMIN)
 * POST   /admin/admins/invite           → nouveau compte SANS rôle client, mot de passe par lien (48 h) ;
 *                                         compte existant : profil posé, email « accès accordé »
 * PATCH  /admin/admins/:id              → changement de profil (jamais le dernier SUPER_ADMIN)
 * DELETE /admin/admins/:id              → retrait de l'accès admin (jamais soi-même, jamais le dernier SUPER_ADMIN)
 * POST   /auth/admin/invite/accept      (public, jeton) → mot de passe défini
 */
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { AcceptAdminInviteRequestSchema, InviteAdminRequestSchema, ObjectIdSchema, UpdateAdminRoleRequestSchema, resolveLocale, type AdminAccount } from "@packages/api-contracts";
import { localeFromHeaders, normalizeEmail, validatePasswordStrength } from "../utils/auth.helper";
import { generateUniquePublicSlug } from "../utils/slug.helper";
import { sendAuthEmail } from "../emails/send-auth-email";
import { adminRoleLabel, getAdminEmails } from "../emails/admin-emails";
import { NO_ADMIN_ROLES, adminRolesData, adminRolesOf, superAdminCount } from "../utils/admin-roles";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";
const ADMIN_UI_URL = (process.env.ADMIN_UI_URL || "http://localhost:3001").replace(/\/$/, "");
const INVITE_TTL_HOURS = 48;
const inviteKey = (token: string) => `admin_invite:${token}`;

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function meta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function toAccount(u: { id: string; firstName: string; lastName: string; email: string; adminRole: string | null; adminRoles?: string[] | null; totpEnabledAt: Date | null; passwordHash: string | null; createdAt: Date }): AdminAccount {
  const roles = adminRolesOf(u);
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    adminRole: (u.adminRole ?? roles[0]) as AdminAccount["adminRole"],
    adminRoles: roles,
    totpEnabled: !!u.totpEnabledAt,
    inviteAccepted: !!u.passwordHash,
    createdAt: u.createdAt.toISOString(),
  };
}

export const listAdmins = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.user.findMany({ where: { isDeleted: false, OR: [{ adminRole: { not: null }, }, { adminRoles: { isEmpty: false } }] }, orderBy: { createdAt: "asc" } });
    res.status(200).json({ items: rows.map(toAccount) });
  } catch (e) {
    next(e);
  }
};

export const inviteAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = InviteAdminRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const { email, firstName, lastName } = parsed.data;
    const rolesData = adminRolesData(parsed.data.adminRoles);
    const adminRoles = rolesData.adminRoles; // C-PR3bis — liste + profil principal
    const rolesLabel = (locale: string) => adminRoles.map((r) => adminRoleLabel(locale, r)).join(" + ");
    const emailKey = normalizeEmail(email);
    const inviter = `${req.user.firstName} ${req.user.lastName}`;
    const now = new Date();
    const existing = await prisma.user.findUnique({ where: { emailNormalized: emailKey } });

    if (existing) {
      if (existing.adminRole) throw new ValidationError("This account already has an admin profile.");
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: { ...rolesData, roles: existing.roles.includes("ADMIN") ? existing.roles : [...existing.roles, "ADMIN"], invitedByAdminId: req.user.id, adminInvitedAt: now, totpBackupCodeHashes: existing.totpBackupCodeHashes ?? [] },
        });
        await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_INVITED", targetType: "USER", targetId: existing.id, after: { adminRoles, existingAccount: true }, ...meta(req) });
      });
      const locale = resolveLocale(existing.preferredLocale);
      await sendAuthEmail(existing.email, locale, getAdminEmails(locale).adminAccessGranted({ firstName: existing.firstName, invitedBy: inviter, roleLabel: rolesLabel(locale), loginUrl: `${ADMIN_UI_URL}/login`, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
      return res.status(200).json({ ok: true, userId: existing.id, existingAccount: true });
    }

    // Nouveau compte : AUCUN rôle client (il ne publie pas, n'envoie pas), pas de mot de passe avant le lien.
    const locale = localeFromHeaders(req.headers as Record<string, unknown>);
    // Pitfall Mongo : `publicSlug` est unique ET nullable → deux null entrent en collision (P2002). Toujours un slug.
    const publicSlug = await generateUniquePublicSlug(firstName, lastName);
    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          emailNormalized: emailKey,
          publicSlug,
          roles: ["ADMIN"],
          ...rolesData,
          preferredLocale: locale,
          invitedByAdminId: req.user.id,
          adminInvitedAt: now,
          totpBackupCodeHashes: [],
        },
      });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_INVITED", targetType: "USER", targetId: u.id, after: { adminRoles, existingAccount: false }, ...meta(req) });
      return u;
    });
    const token = crypto.randomBytes(32).toString("hex");
    await redis.set(inviteKey(token), created.id, "EX", INVITE_TTL_HOURS * 3600);
    await sendAuthEmail(created.email, locale, getAdminEmails(locale).adminInvite({ firstName, invitedBy: inviter, roleLabel: rolesLabel(locale), acceptUrl: `${ADMIN_UI_URL}/invite?token=${token}`, expiresInHours: INVITE_TTL_HOURS, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
    return res.status(201).json({ ok: true, userId: created.id, existingAccount: false, expiresInHours: INVITE_TTL_HOURS });
  } catch (e) {
    return next(e);
  }
};

export const updateAdminRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid id.");
    const parsed = UpdateAdminRoleRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const target = await prisma.user.findUnique({ where: { id: id.data } });
    const before = target ? adminRolesOf(target) : [];
    if (!target || before.length === 0) throw new NotFoundError("Admin account not found.");
    if (target.id === req.user.id) throw new ForbiddenError("You cannot change your own profile.");
    const next = adminRolesData(parsed.data.adminRoles).adminRoles;
    if (before.includes("SUPER_ADMIN") && !next.includes("SUPER_ADMIN") && (await superAdminCount()) <= 1) {
      throw new ForbiddenError("The last super administrator cannot be downgraded.");
    }
    const rolesData = adminRolesData(next);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: rolesData });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_ROLE_CHANGED", targetType: "USER", targetId: target.id, before: { adminRoles: before }, after: { adminRoles: next }, ...meta(req) });
    });
    res.status(200).json({ ok: true, adminRoles: next, adminRole: rolesData.adminRole });
  } catch (e) {
    next(e);
  }
};

export const revokeAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid id.");
    const target = await prisma.user.findUnique({ where: { id: id.data } });
    const before = target ? adminRolesOf(target) : [];
    if (!target || before.length === 0) throw new NotFoundError("Admin account not found.");
    if (target.id === req.user.id) throw new ForbiddenError("You cannot revoke your own access.");
    if (before.includes("SUPER_ADMIN") && (await superAdminCount()) <= 1) throw new ForbiddenError("The last super administrator cannot be revoked.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { ...NO_ADMIN_ROLES, roles: target.roles.filter((r) => r !== "ADMIN"), totpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, totpBackupCodeHashes: [] },
      });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_REVOKED", targetType: "USER", targetId: target.id, before: { adminRoles: before }, ...meta(req) });
    });
    // Ses sessions admin tombent avec le profil (isAdminAuthenticated relit la base).
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `admin_jti:${target.id}:*`, "COUNT", 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/** Public (jeton) : l'invité définit son mot de passe, puis se connecte (2FA au premier login). */
export const acceptAdminInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AcceptAdminInviteRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const userId = await redis.get(inviteKey(parsed.data.token));
    if (!userId) throw new ValidationError("This invitation link is invalid or expired.");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || adminRolesOf(user).length === 0) throw new ValidationError("This invitation link is invalid or expired.");
    validatePasswordStrength(parsed.data.password, { email: user.email, firstName: user.firstName, lastName: user.lastName });
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_INVITE_ACCEPTED", targetType: "USER", targetId: user.id, ...meta(req) });
    });
    await redis.del(inviteKey(parsed.data.token));
    res.status(200).json({ ok: true, email: user.email });
  } catch (e) {
    next(e);
  }
};
