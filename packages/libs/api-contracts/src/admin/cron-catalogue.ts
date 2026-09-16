/**
 * cron-catalogue.ts — les crons attendus et le seuil de parking de l'outbox (A176, A178 — recette 02-ADMIN § 5.22)
 * ==============================================================================================================
 * Un cron qui n'a jamais laissé de battement est invisible dans la liste des battements : la page « État des services »
 * compare donc Redis à ce catalogue et montre les absents. Un test d'auth-service (`cron-catalogue.spec.ts`) lit les
 * fichiers `apps/<service>/src/cron/*.cron.ts` : un cron ajouté sans sa ligne ici fait échouer la CI.
 */
import { z } from "zod";

/** A176 — le relais parque un événement après ce nombre de tentatives. Seule source : les deux relais l'importent. */
export const OUTBOX_MAX_RELAY_ATTEMPTS = 10;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const CronCatalogueEntrySchema = z
  .object({ service: z.string(), name: z.string(), schedule: z.string(), intervalMs: z.number().int() })
  .meta({ id: "CronCatalogueEntry", description: "An expected cron (A178): service, name, cron expression, expected interval" });
export type CronCatalogueEntry = z.infer<typeof CronCatalogueEntrySchema>;

export const CRON_CATALOGUE: readonly CronCatalogueEntry[] = [
  { service: "auth-service", name: "onboarding-reminder", schedule: "0 * * * *", intervalMs: HOUR },
  { service: "deal-service", name: "expire-bookings", schedule: "*/5 * * * *", intervalMs: 5 * MIN },
  { service: "deal-service", name: "ops-alerts", schedule: "5 * * * *", intervalMs: HOUR },
  { service: "deal-service", name: "ops-digest", schedule: "0 8 * * *", intervalMs: DAY },
  { service: "deal-service", name: "outbox-retention", schedule: "55 3 * * *", intervalMs: DAY },
  { service: "deal-service", name: "payout-bookings", schedule: "*/5 * * * *", intervalMs: 5 * MIN },
  { service: "deal-service", name: "rating", schedule: "17 * * * *", intervalMs: HOUR },
  { service: "deal-service", name: "recipient-redaction", schedule: "40 3 * * *", intervalMs: DAY },
  { service: "message-service", name: "conversation-retention", schedule: "30 3 * * *", intervalMs: DAY },
  { service: "message-service", name: "outbox-retention", schedule: "55 3 * * *", intervalMs: DAY },
  { service: "message-service", name: "unread-reminder", schedule: "*/5 * * * *", intervalMs: 5 * MIN },
  { service: "notification-service", name: "retention", schedule: "50 3 * * *", intervalMs: DAY },
  { service: "trip-service", name: "complete-trips", schedule: "15 3 * * *", intervalMs: DAY },
];

/** Règle pure : « en retard ? » = dernier battement plus vieux que deux intervalles attendus. Cron hors catalogue → jamais. */
export function isCronLate(run: { service: string; name: string; ranAt: string }, now: Date = new Date(), catalogue: readonly CronCatalogueEntry[] = CRON_CATALOGUE): boolean {
  const entry = catalogue.find((c) => c.service === run.service && c.name === run.name);
  if (!entry) return false;
  return now.getTime() - new Date(run.ranAt).getTime() > 2 * entry.intervalMs;
}

/** Règle pure : les crons du catalogue sans battement (Redis vidé, cron jamais passé, cron non enveloppé). */
export function missingCrons(runs: ReadonlyArray<{ service: string; name: string }>, catalogue: readonly CronCatalogueEntry[] = CRON_CATALOGUE): CronCatalogueEntry[] {
  const seen = new Set(runs.map((r) => `${r.service}:${r.name}`));
  return catalogue.filter((c) => !seen.has(`${c.service}:${c.name}`));
}
