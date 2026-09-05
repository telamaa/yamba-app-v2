/**
 * admin-status.controller.ts — maintenance et état des services (C-PR8c, D64)
 * ===========================================================================
 * GET/PUT /admin/maintenance · GET /admin/status (agrège les /health, les battements des crons,
 * l'outbox, les emails en échec, la maintenance). Pas un outil de supervision : Sentry garde les
 * erreurs, un moniteur externe reste nécessaire avant le lancement.
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { listCronRuns } from "@packages/libs/redis/cron-heartbeat";
import { platformSettings } from "@packages/libs/settings/default";
import { UpdateMaintenanceRequestSchema, resolveLocale, type AdminStatusResponse, type HealthReport } from "@packages/api-contracts";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAdminEmails } from "../emails/admin-emails";
import { makeMaintenanceService, type MaintenanceDb } from "../services/maintenance.service";

const ADMIN_UI_URL = process.env.ADMIN_UI_URL || "http://localhost:3001";
const HEALTH_TIMEOUT_MS = 2_500;

/** Les six services, ports par défaut du poste, surchargeables par l'environnement. */
export const SERVICE_URLS: Array<{ name: string; url: string; path: string }> = [
  { name: "api-gateway", url: process.env.GATEWAY_URL ?? "http://localhost:8080", path: "/gateway-health" },
  { name: "auth-service", url: process.env.AUTH_SERVICE_URL ?? `http://localhost:${process.env.AUTH_SERVICE_PORT ?? 6001}`, path: "/health" },
  { name: "trip-service", url: process.env.TRIP_SERVICE_URL ?? "http://localhost:6002", path: "/health" },
  { name: "deal-service", url: process.env.DEAL_SERVICE_URL ?? "http://localhost:6003", path: "/health" },
  { name: "notification-service", url: process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:6004", path: "/health" },
  { name: "message-service", url: process.env.MESSAGE_SERVICE_URL ?? "http://localhost:6005", path: "/health" },
];

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

async function notifySuperAdmins(n: { actorId: string; before: { enabled: boolean }; after: { enabled: boolean; scheduledAt: string | null; messageFr: string }; reason: string }): Promise<void> {
  const [actor, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: n.actorId }, select: { firstName: true, lastName: true } }),
    prisma.user.findMany({ where: { roles: { has: "ADMIN" }, adminRoles: { has: "SUPER_ADMIN" }, isDeleted: false }, select: { email: true, firstName: true, preferredLocale: true } }),
  ]);
  const byName = actor ? `${actor.firstName} ${actor.lastName.charAt(0)}.` : "un administrateur";
  await Promise.all(
    admins.map((a) => {
      const locale = resolveLocale(a.preferredLocale);
      return sendAuthEmail(a.email, locale, getAdminEmails(locale).maintenanceChanged({ firstName: a.firstName, byName, enabled: n.after.enabled, scheduledAt: n.after.scheduledAt, message: n.after.messageFr, reason: n.reason, statusUrl: `${ADMIN_UI_URL}/status` })).catch(() => undefined);
    })
  );
}

export const maintenanceService = makeMaintenanceService({ db: prisma as unknown as MaintenanceDb, notify: notifySuperAdmins });

export const getMaintenance = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json(await maintenanceService.read());
  } catch (e) {
    return next(e);
  }
};

export const updateMaintenance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateMaintenanceRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    return res.status(200).json(await maintenanceService.update({ id: req.user.id, ip: req.ip ?? null, userAgent: (req.headers["user-agent"] as string | undefined) ?? null }, parsed.data));
  } catch (e) {
    return next(e);
  }
};

async function probe(entry: { name: string; url: string; path: string }): Promise<AdminStatusResponse["services"][number]> {
  const t0 = Date.now();
  try {
    const r = await fetch(`${entry.url}${entry.path}`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    const body = (await r.json().catch(() => null)) as HealthReport | null;
    return { name: entry.name, url: entry.url, reachable: r.ok, ms: Date.now() - t0, report: body && typeof body === "object" && "status" in body ? body : null, error: r.ok ? null : `HTTP ${r.status}` };
  } catch (err) {
    return { name: entry.name, url: entry.url, reachable: false, ms: Date.now() - t0, report: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const getStatus = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const parkedThreshold = (await platformSettings().get())["alerts.outboxParkedAttempts"];
    const [services, crons, unpublished, oldest, parked, failed, sent, maintenance] = await Promise.all([
      Promise.all(SERVICE_URLS.map(probe)),
      listCronRuns(redis).catch(() => []),
      prisma.outboxEvent.count({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] } as never }),
      prisma.outboxEvent.findFirst({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] } as never, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
      prisma.outboxEvent.count({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }], attempts: { gte: parkedThreshold } } as never }),
      prisma.emailDelivery.count({ where: { status: "FAILED", claimedAt: { gte: dayAgo } } }),
      prisma.emailDelivery.count({ where: { status: "SENT", claimedAt: { gte: dayAgo } } }),
      maintenanceService.read(),
    ]);
    const body: AdminStatusResponse = {
      at: now.toISOString(),
      services,
      crons,
      outbox: { unpublished, oldestUnpublishedAt: oldest?.occurredAt.toISOString() ?? null, parked, parkedThreshold },
      emails: { failedLast24h: failed, sentLast24h: sent },
      maintenance,
    };
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(body);
  } catch (e) {
    return next(e);
  }
};
