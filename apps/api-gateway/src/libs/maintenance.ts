/**
 * maintenance.ts — le mode lecture seule au gateway (C-PR8c, D64 1A/2A)
 * =====================================================================
 * Deux interrupteurs : la base (document `PlatformSettings` clé `maintenance`, réglé par l'admin,
 * relu toutes les 10 s, REPLI = dernière valeur connue ou hors maintenance si la base est
 * injoignable) et l'environnement (`MAINTENANCE_MODE=on`) pour le jour où Mongo est la panne.
 * En maintenance : 503 `MAINTENANCE` + `Retry-After` sur les écritures, sauf auth et admin.
 * `GET /api/maintenance` (public) sert les bandeaux des deux fronts.
 */
import type { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { DEFAULT_MAINTENANCE_SNAPSHOT, envOverride, isBlocked, snapshotFrom, type MaintenanceSnapshot } from "@packages/libs/maintenance";

export const MAINTENANCE_POLL_MS = 10_000;
export const MAINTENANCE_RETRY_AFTER_SECONDS = 300;

let cached: MaintenanceSnapshot = DEFAULT_MAINTENANCE_SNAPSHOT;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const row = await prisma.platformSettings.findUnique({ where: { key: "maintenance" } });
        cached = row ? snapshotFrom(row.values) : DEFAULT_MAINTENANCE_SNAPSHOT;
      } catch {
        // Repli sûr : la dernière valeur connue. L'environnement reste le dernier recours.
      } finally {
        fetchedAt = Date.now();
        inflight = null;
      }
    })();
  }
  return inflight;
}

export async function currentMaintenance(): Promise<MaintenanceSnapshot> {
  const env = envOverride(process.env);
  if (env) return env;
  if (Date.now() - fetchedAt >= MAINTENANCE_POLL_MS) await refresh();
  return cached;
}

export function maintenanceMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const state = await currentMaintenance();
    if (!isBlocked(req.method, req.path, state)) return next();
    res.setHeader("Retry-After", String(MAINTENANCE_RETRY_AFTER_SECONDS));
    return res.status(503).json({ code: "MAINTENANCE", message: state.message.fr || "Maintenance en cours.", messages: state.message, retryAfterSeconds: MAINTENANCE_RETRY_AFTER_SECONDS });
  };
}

export function publicMaintenanceHandler() {
  return async (_req: Request, res: Response) => {
    const state = await currentMaintenance();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ enabled: state.enabled, message: state.message, scheduledAt: state.scheduledAt });
  };
}
