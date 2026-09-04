/**
 * ops-alerts.service.ts — alertes de seuil : instantané + évaluation + envoi dédoublonné (C-PR6b, D59 3A / 4A)
 * ============================================================================================================
 * Sans état : `evaluate()` relit la base à chaque appel (accueil admin). Le cron horaire n'envoie un email
 * au support qu'à la première apparition d'une règle dans la journée (clé Redis, injectée : testable avec un Map).
 */
import prisma from "@packages/libs/prisma";
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import type { OpsAlert, OpsAlertsResponse } from "@packages/api-contracts";
import { OPS_EMAILS } from "../emails/ops-emails";
import { ALERT_SENT_TTL_SECONDS, ALERT_THRESHOLDS, alertSentKey, evaluateAlerts, type OpsSnapshot } from "./ops-alerts.rules";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@yamba.app";
const ADMIN_URL = (process.env.ADMIN_UI_URL ?? "http://localhost:3001").replace(/\/$/, "");

/** Sous-ensemble Redis utilisé (un Map suffit en test). */
export type AlertDedupStore = { set(key: string, value: string, mode: "EX", seconds: number, flag: "NX"): Promise<unknown> };

const H = 3_600_000; const D = 86_400_000;

export async function collectOpsSnapshot(now: Date): Promise<OpsSnapshot> {
  const T = ALERT_THRESHOLDS;
  const unresolvedReversal = { OR: [{ payoutReversalResolution: { isSet: false } }, { payoutReversalResolution: null }] };
  const [failedPayouts, disputes, held, reversals, parked, oldestUnpublished, failedEmails, lastTrip, requests, accepted] = await Promise.all([
    prisma.booking.count({ where: { isDeleted: false, payoutStatus: "FAILED", status: { in: ["COMPLETED", "CANCELLED"] }, OR: [{ completedAt: { lt: new Date(now.getTime() - T.payoutFailedHours * H) } }, { closedAt: { lt: new Date(now.getTime() - T.payoutFailedHours * H) } }] } as never }),
    prisma.dispute.findMany({ where: { status: { in: ["OPEN", "CARRIER_RESPONDED"] } }, select: { createdAt: true, carrierRespondedAt: true } }),
    prisma.booking.count({ where: { isDeleted: false, status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", closedAt: { lt: new Date(now.getTime() - T.retentionHeldDays * D) } } }),
    prisma.booking.count({ where: { isDeleted: false, payoutStatus: "REVERSED", updatedAt: { lt: new Date(now.getTime() - T.reversalOpenHours * H) }, ...unresolvedReversal } as never }),
    prisma.outboxEvent.count({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }], attempts: { gte: T.outboxParkedAttempts } } as never }),
    prisma.outboxEvent.findFirst({ where: { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }], attempts: { lt: T.outboxParkedAttempts } } as never, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
    prisma.emailDelivery.count({ where: { status: "FAILED", claimedAt: { gte: new Date(now.getTime() - T.emailsFailedWindowHours * H) } } }),
    prisma.trip.findFirst({ where: { isDeleted: false, publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    prisma.booking.count({ where: { isDeleted: false, requestedAt: { gte: new Date(now.getTime() - T.acceptanceRateWindowDays * D) } } }),
    prisma.booking.count({ where: { isDeleted: false, requestedAt: { gte: new Date(now.getTime() - T.acceptanceRateWindowDays * D) }, acceptedAt: { not: null } } }),
  ]);
  // Litige décidable (réponse reçue OU 72 h passées) et toujours sans décision depuis plus de 72 h
  const decidableSince = (d: { createdAt: Date; carrierRespondedAt: Date | null }) => d.carrierRespondedAt ?? new Date(d.createdAt.getTime() + 72 * H);
  const undecided = disputes.filter((d) => now.getTime() - decidableSince(d).getTime() > T.disputeUndecidedHours * H).length;
  return {
    failedPayoutsOverThreshold: failedPayouts,
    undecidedDisputesOverThreshold: undecided,
    heldRetentionsOverThreshold: held,
    openReversalsOverThreshold: reversals,
    parkedOutbox: parked,
    oldestUnpublishedAt: oldestUnpublished?.occurredAt ?? null,
    failedEmailsInWindow: failedEmails,
    lastTripPublishedAt: lastTrip?.publishedAt ?? null,
    requestsInWindow: requests,
    acceptedInWindow: accepted,
  };
}

export function makeOpsAlertsService(clock: () => Date = () => new Date()) {
  return {
    async evaluate(): Promise<OpsAlertsResponse> {
      const now = clock();
      const alerts = evaluateAlerts(await collectOpsSnapshot(now), now);
      return { alerts, evaluatedAt: now.toISOString(), thresholds: { ...ALERT_THRESHOLDS } };
    },
    /** Cron horaire : email au support pour les alertes qui apparaissent pour la première fois aujourd'hui. Retourne les règles envoyées. */
    async notifyNewAlerts(store: AlertDedupStore, alerts?: OpsAlert[]): Promise<string[]> {
      const now = clock();
      const active = alerts ?? evaluateAlerts(await collectOpsSnapshot(now), now);
      const fresh: OpsAlert[] = [];
      for (const a of active) {
        const first = await store.set(alertSentKey(a.rule, now), "1", "EX", ALERT_SENT_TTL_SECONDS, "NX");
        if (first) fresh.push(a);
      }
      if (fresh.length === 0 || !isEmailConfigured()) return fresh.map((a) => a.rule);
      const built = OPS_EMAILS.fr.opsAlerts({ date: now.toLocaleString("fr-FR"), alerts: fresh.map((a) => ({ title: a.title, detail: a.detail, url: `${ADMIN_URL}${a.href}` })), adminUrl: `${ADMIN_URL}/home` });
      await sendTransactionalEmail({ to: SUPPORT_EMAIL, locale: "fr", subject: built.subject, content: built.content }).catch(() => undefined);
      return fresh.map((a) => a.rule);
    },
  };
}
export type OpsAlertsService = ReturnType<typeof makeOpsAlertsService>;
