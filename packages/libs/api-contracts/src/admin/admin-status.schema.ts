/**
 * admin-status.schema.ts — maintenance et état des services (C-PR8c, D64)
 * =======================================================================
 */
import { z } from "zod";

export const MAINTENANCE_REASON_MIN_LENGTH = 20;
export const MAINTENANCE_RETRY_AFTER_SECONDS = 300;

/** État planifié en base (document `PlatformSettings` clé `maintenance`). */
export const MaintenanceStateSchema = z
  .object({
    enabled: z.boolean(),
    messageFr: z.string().max(300),
    messageEn: z.string().max(300),
    scheduledAt: z.string().datetime().nullable().meta({ description: "Annonce affichée avant la coupure (bandeau), null = aucune" }),
    updatedAt: z.string().datetime().nullable(),
    updatedBy: z.string().nullable(),
    version: z.number().int(),
    /** Interrupteur d'environnement du gateway (MAINTENANCE_MODE=on) — lecture seule ici. */
    envOverride: z.boolean().optional(),
  })
  .meta({ id: "MaintenanceState" });
export type MaintenanceState = z.infer<typeof MaintenanceStateSchema>;

export const UpdateMaintenanceRequestSchema = z
  .object({
    enabled: z.boolean(),
    messageFr: z.string().trim().max(300).default(""),
    messageEn: z.string().trim().max(300).default(""),
    scheduledAt: z.string().datetime().nullable().default(null),
    reason: z.string().trim().min(MAINTENANCE_REASON_MIN_LENGTH).max(500),
    expectedVersion: z.number().int().min(0),
  })
  .meta({ id: "UpdateMaintenanceRequest" });
export type UpdateMaintenanceRequest = z.infer<typeof UpdateMaintenanceRequestSchema>;

/** Public (gateway) — ce que les bandeaux lisent. */
export const PublicMaintenanceSchema = z
  .object({ enabled: z.boolean(), message: z.object({ fr: z.string(), en: z.string() }), scheduledAt: z.string().datetime().nullable() })
  .meta({ id: "PublicMaintenance" });
export type PublicMaintenance = z.infer<typeof PublicMaintenanceSchema>;

export const HealthCheckSchema = z.object({ ok: z.boolean(), ms: z.number().int(), error: z.string().nullable() }).meta({ id: "HealthCheck" });
export const HealthReportSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    service: z.string(),
    version: z.string(),
    uptimeSeconds: z.number().int(),
    checks: z.record(z.string(), HealthCheckSchema),
    at: z.string().datetime(),
  })
  .meta({ id: "HealthReport", description: "Uniform /health of every service (D64 3A)" });
export type HealthReport = z.infer<typeof HealthReportSchema>;

export const CronRunSchema = z
  .object({ service: z.string(), name: z.string(), ranAt: z.string().datetime(), durationMs: z.number().int(), ok: z.boolean(), summary: z.string().nullable(), error: z.string().nullable(), schedule: z.string().nullable() })
  .meta({ id: "CronRun", description: "Last heartbeat of a cron (Redis, 7 days) — D64 4A" });
export type CronRun = z.infer<typeof CronRunSchema>;

export const ServiceStatusSchema = z
  .object({ name: z.string(), url: z.string(), reachable: z.boolean(), ms: z.number().int(), report: HealthReportSchema.nullable(), error: z.string().nullable() })
  .meta({ id: "ServiceStatus" });

export const AdminStatusResponseSchema = z
  .object({
    at: z.string().datetime(),
    services: z.array(ServiceStatusSchema),
    crons: z.array(CronRunSchema),
    outbox: z.object({ unpublished: z.number().int(), oldestUnpublishedAt: z.string().datetime().nullable(), parked: z.number().int(), parkedThreshold: z.number().int() }),
    emails: z.object({ failedLast24h: z.number().int(), sentLast24h: z.number().int() }),
    maintenance: MaintenanceStateSchema,
  })
  .meta({ id: "AdminStatusResponse", description: "Service status page (D64 5A) — not a monitoring tool" });
export type AdminStatusResponse = z.infer<typeof AdminStatusResponseSchema>;
