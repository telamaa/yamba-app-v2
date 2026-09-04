/**
 * ops-alerts.rules.ts — alertes de seuil, PURES (C-PR6b, D59 3A / 4A)
 * ===================================================================
 * Seuils en constantes versionnées (réglables en base avec C-PR8). `evaluateAlerts` reçoit un
 * instantané de compteurs et renvoie les alertes actives — sans état, testable sans base.
 */
import type { OpsAlert } from "@packages/api-contracts";

export const ALERT_THRESHOLDS = {
  payoutFailedHours: 48,
  disputeUndecidedHours: 72,
  retentionHeldDays: 7,
  reversalOpenHours: 48,
  outboxParkedAttempts: 10,
  outboxLagMinutes: 15,
  emailsFailedWindowHours: 24,
  noTripPublishedDays: 7,
  acceptanceRateWindowDays: 7,
  acceptanceRateMinPct: 30,
  acceptanceRateMinRequests: 5,
} as const;

export type OpsSnapshot = {
  failedPayoutsOverThreshold: number;
  undecidedDisputesOverThreshold: number;
  heldRetentionsOverThreshold: number;
  openReversalsOverThreshold: number;
  parkedOutbox: number;
  oldestUnpublishedAt: Date | null;
  failedEmailsInWindow: number;
  lastTripPublishedAt: Date | null;
  requestsInWindow: number;
  acceptedInWindow: number;
};

export function evaluateAlerts(s: OpsSnapshot, now: Date): OpsAlert[] {
  const T = ALERT_THRESHOLDS;
  const out: OpsAlert[] = [];
  if (s.failedPayoutsOverThreshold > 0) out.push({ rule: "PAYOUT_FAILED_48H", severity: "critical", title: "Versements en échec depuis plus de 48 h", detail: `${s.failedPayoutsOverThreshold} versement(s) rejoué(s) sans succès depuis plus de ${T.payoutFailedHours} h.`, count: s.failedPayoutsOverThreshold, href: "/finances?kind=FAILED" });
  if (s.undecidedDisputesOverThreshold > 0) out.push({ rule: "DISPUTE_UNDECIDED_72H", severity: "critical", title: "Litiges décidables sans décision", detail: `${s.undecidedDisputesOverThreshold} litige(s) tranchable(s) depuis plus de ${T.disputeUndecidedHours} h.`, count: s.undecidedDisputesOverThreshold, href: "/disputes?decidable=1" });
  if (s.heldRetentionsOverThreshold > 0) out.push({ rule: "RETENTION_HELD_7D", severity: "warning", title: "Retenues non arbitrées", detail: `${s.heldRetentionsOverThreshold} retenue(s) conservée(s) depuis plus de ${T.retentionHeldDays} j.`, count: s.heldRetentionsOverThreshold, href: "/disputes?kind=RETENTION" });
  if (s.openReversalsOverThreshold > 0) out.push({ rule: "REVERSAL_OPEN_48H", severity: "warning", title: "Transferts renversés sans décision", detail: `${s.openReversalsOverThreshold} renversement(s) ouvert(s) depuis plus de ${T.reversalOpenHours} h.`, count: s.openReversalsOverThreshold, href: "/finances?kind=REVERSED" });
  if (s.parkedOutbox > 0) out.push({ rule: "OUTBOX_PARKED", severity: "critical", title: "Événements parqués (relais)", detail: `${s.parkedOutbox} événement(s) jamais publié(s) après ${T.outboxParkedAttempts} tentatives : notifications et emails de ces deals ne partent pas.`, count: s.parkedOutbox, href: "/pilotage" });
  const lagMin = s.oldestUnpublishedAt ? (now.getTime() - s.oldestUnpublishedAt.getTime()) / 60_000 : 0;
  if (lagMin > T.outboxLagMinutes) out.push({ rule: "OUTBOX_LAGGING_15MIN", severity: "critical", title: "Relais outbox en retard", detail: `Le plus ancien événement non publié attend depuis ${Math.round(lagMin)} min (seuil ${T.outboxLagMinutes}). Redpanda ou le relais est arrêté ?`, count: null, href: "/pilotage" });
  if (s.failedEmailsInWindow > 0) out.push({ rule: "EMAILS_FAILED_24H", severity: "warning", title: "Emails en échec", detail: `${s.failedEmailsInWindow} email(s) en échec sur ${T.emailsFailedWindowHours} h (SMTP, adresse invalide ?).`, count: s.failedEmailsInWindow, href: "/pilotage" });
  const daysSinceTrip = s.lastTripPublishedAt ? (now.getTime() - s.lastTripPublishedAt.getTime()) / 86_400_000 : Infinity;
  if (daysSinceTrip > T.noTripPublishedDays) out.push({ rule: "NO_TRIP_PUBLISHED_7D", severity: "warning", title: "Aucun trajet publié récemment", detail: s.lastTripPublishedAt ? `Dernier trajet publié il y a ${Math.floor(daysSinceTrip)} j (seuil ${T.noTripPublishedDays}). Liquidité : recruter des Voyageurs.` : "Aucun trajet n'a jamais été publié.", count: null, href: "/pilotage" });
  if (s.requestsInWindow >= T.acceptanceRateMinRequests) {
    const pct = Math.round((s.acceptedInWindow / s.requestsInWindow) * 100);
    if (pct < T.acceptanceRateMinPct) out.push({ rule: "ACCEPTANCE_RATE_LOW_7D", severity: "warning", title: "Taux d'acceptation bas", detail: `${pct} % des ${s.requestsInWindow} demandes des ${T.acceptanceRateWindowDays} derniers jours ont été acceptées (seuil ${T.acceptanceRateMinPct} %).`, count: s.requestsInWindow - s.acceptedInWindow, href: "/pilotage" });
  }
  return out;
}

/** Clé de dédoublonnage : une alerte par règle et par jour (UTC) — le cron n'envoie l'email qu'à la première apparition. */
export const alertSentKey = (rule: string, now: Date) => `yamba:alerts:sent:${rule}:${now.toISOString().slice(0, 10)}`;
export const ALERT_SENT_TTL_SECONDS = 2 * 86_400;
