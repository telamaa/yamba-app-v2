/**
 * admin-admins.controller.ts — comptes du back-office (C-PR3, D56 1A + invitation)
 * =================================================================================
 * GET    /admin/admins                  (admins.manage = SUPER_ADMIN)
 * POST   /admin/admins/invite           → nouveau compte SANS rôle client, mot de passe par lien (48 h) ;
 *                                         compte existant : profil posé, email « accès accordé »
 * PATCH  /admin/admins/:id              → changement de profil (jamais le dernier SUPER_ADMIN)
 * DELETE /admin/admins/:id              → retrait de l'accès admin (jamais soi-même, jamais le dernier SUPER_ADMIN), motif facultatif
 * POST   /admin/admins/:id/invite/resend → A189 a : nouveau lien pour une invitation en attente (l'ancien meurt)
 * POST   /auth/admin/invite/accept      (public, jeton) → mot de passe défini
 *
 * Recette 02-ADMIN § 5.25 (A185, A186) : un lien vivant par compte, à usage unique ; un compte sans mot de passe reçoit un
 * lien, jamais « accès accordé » ; il reste toujours un super administrateur EN SERVICE, même sous deux gestes croisés.
 */
import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { AcceptAdminInviteRequestSchema, InviteAdminRequestSchema, ObjectIdSchema, RevokeAdminRequestSchema, UpdateAdminRoleRequestSchema, resolveLocale, type AdminAccount } from "@packages/api-contracts";
import { localeFromHeaders, normalizeEmail, validatePasswordStrength } from "../utils/auth.helper";
import { generateUniquePublicSlug } from "../utils/slug.helper";
import { sendAuthEmail } from "../emails/send-auth-email";
import { adminRoleLabel, getAdminEmails } from "../emails/admin-emails";
import { NO_ADMIN_ROLES, adminRolesData, adminRolesOf } from "../utils/admin-roles";
import { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";
import { ADMIN_ACCOUNTS_GUARD_KEY, canReceiveAccountEmail, inServiceSuperAdminsWhere, inviteKey, inviteMode, inviteUserKey, isPendingInvitation, isUniqueViolation, removesSuperAdmin, rolesChanged } from "../utils/admin-accounts.rules";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";
const ADMIN_UI_URL = (process.env.ADMIN_UI_URL || "http://localhost:3001").replace(/\/$/, "");
const INVITE_TTL_HOURS = 48;

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function meta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function toAccount(u: { id: string; firstName: string; lastName: string; email: string; adminRole: string | null; adminRoles?: string[] | null; totpEnabledAt: Date | null; passwordHash: string | null; createdAt: Date }, inviteExpiresAt: string | null = null): AdminAccount {
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
    inviteExpiresAt,
    createdAt: u.createdAt.toISOString(),
  };
}

export const listAdmins = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.user.findMany({ where: { isDeleted: false, OR: [{ adminRole: { not: null }, }, { adminRoles: { isEmpty: false } }] }, orderBy: { createdAt: "asc" } });
    // A189 a — la fin de validité du lien vivant d'une invitation en attente (null : aucun lien vivant, il faut le renvoyer).
    const items = await Promise.all(rows.map(async (u) => toAccount(u, u.passwordHash ? null : await inviteExpiresAt(u.id))));
    res.status(200).json({ items });
  } catch (e) {
    next(e);
  }
};

/**
 * A185 a — pose le lien d'invitation d'un compte : le lien précédent (s'il vit encore) meurt, un seul lien par compte.
 */
async function issueInviteToken(userId: string): Promise<string> {
  const previous = await redis.get(inviteUserKey(userId));
  if (previous) await redis.del(inviteKey(previous));
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(inviteKey(token), userId, "EX", INVITE_TTL_HOURS * 3600);
  await redis.set(inviteUserKey(userId), token, "EX", INVITE_TTL_HOURS * 3600);
  return token;
}
/** A189 a — fin de validité du lien vivant d'un compte, lue sur le TTL Redis (null si aucun lien vivant). */
async function inviteExpiresAt(userId: string): Promise<string | null> {
  const ttl = await redis.ttl(inviteUserKey(userId));
  return ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;
}

/** A189 c — email de sécurité à l'admin dont les accès changent : après la transaction, best effort, jamais bloquant. */
async function notifyAccessChange(userId: string, build: (locale: string, firstName: string) => ReturnType<ReturnType<typeof getAdminEmails>["adminAccessRevoked"]>): Promise<void> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u || !canReceiveAccountEmail(u)) return;
    const locale = resolveLocale(u.preferredLocale);
    await sendAuthEmail(u.email, locale, build(locale, u.firstName));
  } catch {
    // best effort : le geste est fait et journalisé
  }
}

async function dropInviteToken(userId: string): Promise<void> {
  const token = await redis.get(inviteUserKey(userId));
  if (token) await redis.del(inviteKey(token));
  await redis.del(inviteUserKey(userId));
}

/** A186 b — le document de garde existe avant toute transaction qui l'écrit (deux créations simultanées : l'une gagne). */
async function ensureGuardDocument(): Promise<void> {
  try {
    await prisma.platformSettings.upsert({ where: { key: ADMIN_ACCOUNTS_GUARD_KEY }, create: { key: ADMIN_ACCOUNTS_GUARD_KEY, values: {}, version: 0 }, update: {} });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

/**
 * A186 — DANS la transaction : écrit la garde commune (deux retraits croisés entrent en conflit, le perdant est rejoué), puis
 * compte les AUTRES super administrateurs en service. Zéro → 403 LAST_SUPER_ADMIN.
 */
async function assertAnotherSuperAdminInService(tx: Prisma.TransactionClient, targetId: string, verb: "downgraded" | "revoked"): Promise<void> {
  await tx.platformSettings.update({ where: { key: ADMIN_ACCOUNTS_GUARD_KEY }, data: { version: { increment: 1 } } });
  const others = await tx.user.count({ where: inServiceSuperAdminsWhere(targetId) });
  if (others < 1) throw new ForbiddenError(`The last super administrator cannot be ${verb}.`, { code: "LAST_SUPER_ADMIN" });
}

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
    const mode = inviteMode(existing);
    if (mode.kind === "REFUSED") throw new ValidationError(mode.message, { code: mode.code });

    if (existing && mode.kind !== "NEW") {
      // A185 d — trois invitations simultanées d'un membre = une promotion, une ligne, un email ; les deux autres → 400.
      await withWriteConflictRetry(() =>
        prisma.$transaction(async (tx) => {
          // Relu DANS la transaction : sous trois invitations simultanées, les écritures concurrentes du même compte entrent en
          // conflit (P2034), les perdantes sont rejouées et relisent le profil posé.
          const fresh = await tx.user.findUnique({ where: { id: existing.id } });
          const again = inviteMode(fresh);
          if (again.kind === "REFUSED") throw new ValidationError(again.message, { code: again.code });
          await tx.user.update({
            where: { id: existing.id },
            data: { ...rolesData, roles: fresh!.roles.includes("ADMIN") ? fresh!.roles : [...fresh!.roles, "ADMIN"], invitedByAdminId: req.user.id, adminInvitedAt: now, totpBackupCodeHashes: fresh!.totpBackupCodeHashes ?? [] },
          });
          await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_INVITED", targetType: "USER", targetId: existing.id, after: { adminRoles, existingAccount: true }, ...meta(req) });
        })
      );
      const locale = resolveLocale(existing.preferredLocale);
      if (mode.kind === "PASSWORD_LINK") {
        // ANO-ADM-75 — un compte sans mot de passe (invité retiré avant d'accepter, compte social) ne peut rien saisir à /login :
        // il reçoit le lien pour en poser un.
        const token = await issueInviteToken(existing.id);
        await sendAuthEmail(existing.email, locale, getAdminEmails(locale).adminInvite({ firstName: existing.firstName, invitedBy: inviter, roleLabel: rolesLabel(locale), acceptUrl: `${ADMIN_UI_URL}/invite?token=${token}`, expiresInHours: INVITE_TTL_HOURS, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
        return res.status(200).json({ ok: true, userId: existing.id, existingAccount: true, passwordRequired: true, expiresInHours: INVITE_TTL_HOURS });
      }
      await sendAuthEmail(existing.email, locale, getAdminEmails(locale).adminAccessGranted({ firstName: existing.firstName, invitedBy: inviter, roleLabel: rolesLabel(locale), loginUrl: `${ADMIN_UI_URL}/login`, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
      return res.status(200).json({ ok: true, userId: existing.id, existingAccount: true, passwordRequired: false });
    }

    // Nouveau compte : AUCUN rôle client (il ne publie pas, n'envoie pas), pas de mot de passe avant le lien.
    const locale = localeFromHeaders(req.headers as Record<string, unknown>);
    // Pitfall Mongo : `publicSlug` est unique ET nullable → deux null entrent en collision (P2002). Toujours un slug.
    const publicSlug = await generateUniquePublicSlug(firstName, lastName);
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
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
    } catch (e) {
      // ANO-ADM-79 — deux invitations simultanées de la même adresse : l'unicité de l'email tranche, le perdant lit le même
      // refus qu'une seconde invitation (jamais 500).
      if (isUniqueViolation(e) || (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2034")) {
        throw new ValidationError("This account already has an admin profile.", { code: "ADMIN_ALREADY_GRANTED" });
      }
      throw e;
    }
    const token = await issueInviteToken(created.id);
    await sendAuthEmail(created.email, locale, getAdminEmails(locale).adminInvite({ firstName, invitedBy: inviter, roleLabel: rolesLabel(locale), acceptUrl: `${ADMIN_UI_URL}/invite?token=${token}`, expiresInHours: INVITE_TTL_HOURS, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
    return res.status(201).json({ ok: true, userId: created.id, existingAccount: false, passwordRequired: true, expiresInHours: INVITE_TTL_HOURS });
  } catch (e) {
    return next(e);
  }
};

export const updateAdminRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid id.", { code: "INVALID_ID" });
    const parsed = UpdateAdminRoleRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    if (id.data === req.user.id) throw new ForbiddenError("You cannot change your own profile.", { code: "ADMIN_IS_SELF" });
    const next = adminRolesData(parsed.data.adminRoles).adminRoles;
    const rolesData = adminRolesData(next);
    await ensureGuardDocument();
    let before: string[] = [];
    await withWriteConflictRetry(() =>
      prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: id.data } });
        const current = target && !target.isDeleted ? adminRolesOf(target) : [];
        before = current;
        if (!target || current.length === 0) throw new NotFoundError("Admin account not found.", { code: "ADMIN_NOT_FOUND" });
        if (removesSuperAdmin(current, next)) await assertAnotherSuperAdminInService(tx, target.id, "downgraded");
        await tx.user.update({ where: { id: target.id }, data: rolesData });
        await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_ROLE_CHANGED", targetType: "USER", targetId: target.id, before: { adminRoles: current }, after: { adminRoles: next }, ...meta(req) });
      })
    );
    if (rolesChanged(before, next)) {
      const by = `${req.user.firstName} ${req.user.lastName}`;
      const label = (locale: string, roles: string[]) => roles.map((r) => adminRoleLabel(locale, r)).join(" + ");
      await notifyAccessChange(id.data, (locale, firstName) => getAdminEmails(locale).adminRolesChanged({ firstName, changedBy: by, before: label(locale, before), after: label(locale, next), supportEmail: SUPPORT_EMAIL }));
    }
    res.status(200).json({ ok: true, adminRoles: next, adminRole: rolesData.adminRole });
  } catch (e) {
    next(e);
  }
};

export const revokeAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid id.", { code: "INVALID_ID" });
    if (id.data === req.user.id) throw new ForbiddenError("You cannot revoke your own access.", { code: "ADMIN_IS_SELF" });
    const body = RevokeAdminRequestSchema.safeParse(req.body ?? {});
    if (!body.success) throw new ValidationError("Invalid request", { errors: zodErrors(body.error.issues) });
    const reason = body.data.reason || undefined; // A189 b — facultatif, au journal seulement
    await ensureGuardDocument();
    await withWriteConflictRetry(() =>
      prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: id.data } });
        const before = target ? adminRolesOf(target) : [];
        if (!target || before.length === 0) throw new NotFoundError("Admin account not found.", { code: "ADMIN_NOT_FOUND" });
        if (removesSuperAdmin(before, null)) await assertAnotherSuperAdminInService(tx, target.id, "revoked");
        await tx.user.update({
          where: { id: target.id },
          data: { ...NO_ADMIN_ROLES, roles: target.roles.filter((r) => r !== "ADMIN"), totpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, totpBackupCodeHashes: [] },
        });
        await recordAdminAction(tx, { adminUserId: req.user.id, action: "ADMIN_REVOKED", targetType: "USER", targetId: target.id, before: { adminRoles: before }, ...(reason ? { after: { reason } } : {}), ...meta(req) });
      })
    );
    // A185 a — le lien d'invitation en attente meurt avec l'accès (il revivrait à la réinvitation).
    await dropInviteToken(id.data);
    // Ses sessions admin tombent avec le profil (isAdminAuthenticated relit la base).
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `admin_jti:${id.data}:*`, "COUNT", 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
    const by = `${req.user.firstName} ${req.user.lastName}`;
    await notifyAccessChange(id.data, (locale, firstName) => getAdminEmails(locale).adminAccessRevoked({ firstName, revokedBy: by, supportEmail: SUPPORT_EMAIL }));
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/**
 * A189 a — renvoyer une invitation EN ATTENTE : nouveau lien (l'ancien meurt, A185), email, une ligne ADMIN_INVITE_RESENT.
 * Une invitation acceptée, un compte retiré ou supprimé → 409 ADMIN_INVITE_NOT_PENDING (404 si le compte n'existe pas).
 */
export const resendAdminInvite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = ObjectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new ValidationError("Invalid id.", { code: "INVALID_ID" });
    const user = await prisma.user.findUnique({ where: { id: id.data } });
    if (!user) throw new NotFoundError("Admin account not found.", { code: "ADMIN_NOT_FOUND" });
    if (!isPendingInvitation(user)) throw new ConflictError("This invitation is not pending.", { code: "ADMIN_INVITE_NOT_PENDING" });
    const token = await issueInviteToken(user.id);
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "ADMIN_INVITE_RESENT", targetType: "USER", targetId: user.id, after: { expiresInHours: INVITE_TTL_HOURS }, ...meta(req) });
    const locale = resolveLocale(user.preferredLocale);
    const roleLabel = adminRolesOf(user).map((r) => adminRoleLabel(locale, r)).join(" + ");
    if (canReceiveAccountEmail(user)) {
      await sendAuthEmail(user.email, locale, getAdminEmails(locale).adminInvite({ firstName: user.firstName, invitedBy: `${req.user.firstName} ${req.user.lastName}`, roleLabel, acceptUrl: `${ADMIN_UI_URL}/invite?token=${token}`, expiresInHours: INVITE_TTL_HOURS, supportEmail: SUPPORT_EMAIL })).catch(() => undefined);
    }
    res.status(200).json({ ok: true, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString() });
  } catch (e) {
    next(e);
  }
};

/** Public (jeton) : l'invité définit son mot de passe, puis se connecte (2FA au premier login). */
export const acceptAdminInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AcceptAdminInviteRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const invalid = () => new ValidationError("This invitation link is invalid or expired.", { code: "INVITATION_INVALID" });
    const key = inviteKey(parsed.data.token);
    const userId = await redis.get(key);
    if (!userId) throw invalid();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isDeleted || adminRolesOf(user).length === 0) throw invalid();
    validatePasswordStrength(parsed.data.password, { email: user.email, firstName: user.firstName, lastName: user.lastName });
    // ANO-ADM-77 — le jeton est RÉCLAMÉ avant d'écrire : `DEL` rend 1 à un seul des clics simultanés. Les autres lisent 400.
    const ttl = await redis.ttl(key);
    if ((await redis.del(key)) !== 1) throw invalid();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    try {
      await withWriteConflictRetry(() =>
        prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
          await recordAdminAction(tx, { adminUserId: user.id, action: "ADMIN_INVITE_ACCEPTED", targetType: "USER", targetId: user.id, ...meta(req) });
        })
      );
    } catch (e) {
      // Le lien n'a pas servi : il est rendu pour le temps qui lui restait.
      if (ttl > 0) await redis.set(key, user.id, "EX", ttl).catch(() => undefined);
      throw e;
    }
    await redis.del(inviteUserKey(user.id));
    res.status(200).json({ ok: true, email: user.email });
  } catch (e) {
    next(e);
  }
};
