/**
 * admin-settings.controller.ts — /admin/settings (C-PR8a, D62)
 * ============================================================
 * GET (settings.read, tous les profils) · PATCH · POST /reset (portée vérifiée clé par clé
 * dans le service) · GET /history?key= (le journal filtré sur SETTINGS).
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ResetSettingsRequestSchema, UpdateSettingsRequestSchema, resolveLocale, settingDefinition, type AdminRole } from "@packages/api-contracts";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { platformSettings } from "@packages/libs/settings/default";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAdminEmails } from "../emails/admin-emails";
import { makePlatformSettingsService, type SettingsNotification, type SettingsWriterDb } from "../services/platform-settings.service";

const ADMIN_UI_URL = process.env.ADMIN_UI_URL || "http://localhost:3001";
const HISTORY_PAGE = 50;

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function actorOf(req: AuthenticatedRequest) {
  const roles = (req.adminRoles && req.adminRoles.length ? req.adminRoles : [req.adminRole].filter(Boolean)) as AdminRole[];
  return { id: req.user.id, roles, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
function fmt(def: ReturnType<typeof settingDefinition>, v: number): string {
  if (!def) return String(v);
  if (def.unit === "cents") return `${(v / 100).toFixed(2)} €`;
  if (def.unit === "percent") return `${v} %`;
  return `${v} ${def.unit}`;
}

/** Email à tous les SUPER_ADMIN, dans la langue de chacun (best effort). */
async function notifySuperAdmins(n: SettingsNotification): Promise<void> {
  const actor = n.recipients.find((r) => r.id === n.actorId) ?? (await prisma.user.findUnique({ where: { id: n.actorId }, select: { firstName: true, lastName: true } }));
  const byName = actor ? `${actor.firstName} ${actor.lastName.charAt(0)}.` : "un administrateur";
  await Promise.all(
    n.recipients.map((r) => {
      const locale = resolveLocale(r.preferredLocale);
      const email = getAdminEmails(locale).settingsChanged({
        firstName: r.firstName,
        byName,
        at: n.at.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris" }),
        reason: n.reason,
        changes: n.changes.map((c) => {
          const def = settingDefinition(c.key);
          return { label: def?.label ?? c.key, before: fmt(def, c.before), after: fmt(def, c.after) };
        }),
        settingsUrl: `${ADMIN_UI_URL}/settings`,
        reset: n.reset,
      });
      return sendAuthEmail(r.email, locale, email).catch(() => undefined);
    })
  );
}

export const platformSettingsService = makePlatformSettingsService({
  db: prisma as unknown as SettingsWriterDb,
  notify: notifySuperAdmins,
  invalidate: () => platformSettings().invalidate(),
});

export const getSettings = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json(await platformSettingsService.read());
  } catch (e) {
    return next(e);
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateSettingsRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    return res.status(200).json(await platformSettingsService.update(actorOf(req), parsed.data));
  } catch (e) {
    return next(e);
  }
};

export const resetSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = ResetSettingsRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    return res.status(200).json(await platformSettingsService.reset(actorOf(req), parsed.data));
  } catch (e) {
    return next(e);
  }
};

/** Historique : le journal filtré sur SETTINGS (une clé si ?key=), les plus récents d'abord. */
export const getSettingsHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const key = typeof req.query.key === "string" && req.query.key ? req.query.key : null;
    const cursor = typeof req.query.cursor === "string" && /^[a-f0-9]{24}$/.test(req.query.cursor) ? req.query.cursor : undefined;
    const rows = await prisma.adminAction.findMany({
      where: { targetType: "SETTINGS", ...(key ? { targetId: key } : {}) },
      orderBy: { createdAt: "desc" },
      take: HISTORY_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, HISTORY_PAGE);
    const adminIds = [...new Set(page.map((r) => r.adminUserId))];
    const admins = adminIds.length ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const byId = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName.charAt(0)}.`]));
    return res.status(200).json({
      items: page.map((r) => {
        const after = (r.after ?? {}) as { key?: string; value?: number; reason?: string; version?: number };
        const before = (r.before ?? {}) as { value?: number };
        return { id: r.id, at: r.createdAt.toISOString(), admin: byId.get(r.adminUserId) ?? r.adminUserId, action: r.action, key: r.targetId, before: before.value ?? null, after: after.value ?? null, reason: after.reason ?? null, version: after.version ?? null };
      }),
      nextCursor: rows.length > HISTORY_PAGE ? page[page.length - 1].id : null,
    });
  } catch (e) {
    return next(e);
  }
};
