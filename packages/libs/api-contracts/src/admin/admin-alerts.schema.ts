/**
 * admin-alerts.schema.ts — alertes de seuil (C-PR6b, D59 3A / 4A)
 * ================================================================
 * Calculées à la lecture (aucun stockage), seuils en constantes versionnées côté deal-service.
 */
import { z } from "zod";

export const OpsAlertRuleSchema = z
  .enum(["PAYOUT_FAILED_48H", "DISPUTE_UNDECIDED_72H", "RETENTION_HELD_7D", "REVERSAL_OPEN_48H", "OUTBOX_PARKED", "OUTBOX_LAGGING_15MIN", "EMAILS_FAILED_24H", "NO_TRIP_PUBLISHED_7D", "ACCEPTANCE_RATE_LOW_7D"])
  .meta({ id: "OpsAlertRule" });
export type OpsAlertRule = z.infer<typeof OpsAlertRuleSchema>;

export const OpsAlertSchema = z
  .object({
    rule: OpsAlertRuleSchema,
    severity: z.enum(["warning", "critical"]),
    title: z.string(),
    detail: z.string(),
    count: z.number().int().nullable().describe("Éléments concernés (null pour une alerte de liquidité)"),
    href: z.string().describe("Chemin admin où agir"),
  })
  .meta({ id: "OpsAlert" });
export type OpsAlert = z.infer<typeof OpsAlertSchema>;

export const OpsAlertsResponseSchema = z
  .object({ alerts: z.array(OpsAlertSchema), evaluatedAt: z.string().datetime(), thresholds: z.record(z.string(), z.number()) })
  .meta({ id: "OpsAlertsResponse", description: "Sans état (D59 4A) : recalculées à chaque lecture ; le cron horaire n'envoie un email qu'à la première apparition du jour" });
export type OpsAlertsResponse = z.infer<typeof OpsAlertsResponseSchema>;
