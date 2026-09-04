/**
 * admin-finance.rules.ts — règles PURES finances côté admin (C-PR5a, D58)
 * ========================================================================
 * Aucun accès base ni fournisseur ici : espacement des rejeux (A111), nature d'un
 * échec de versement, chronologie de l'argent d'un deal, rapprochement base ↔
 * fournisseur (A112). Tout est testé dans admin-finance.rules.spec.ts.
 */
import type { MoneyTimelineEvent, PayoutFailureKind, ReconciliationDivergenceCode } from "@packages/api-contracts";
import type { PaymentInspection } from "@packages/payments";

/* ── Rejeux espacés (A111) ─────────────────────────────────── */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Délai avant la PROCHAINE tentative, selon le nombre de tentatives déjà faites.
 * 6 × 5 min (première demi-heure : compte Stripe en cours de finalisation, incident passager),
 * puis 6 × 30 min, puis 12 × 2 h, puis 1 fois par jour — sans plafond : un versement dû finit
 * toujours par partir, ou reste visible dans la file « en échec » (jamais de silence).
 */
export function payoutRetryDelayMs(attemptsDone: number): number {
  const n = Math.max(0, Math.floor(attemptsDone));
  if (n < 6) return 5 * MINUTE;
  if (n < 12) return 30 * MINUTE;
  if (n < 24) return 2 * HOUR;
  return 24 * HOUR;
}

export function nextPayoutRetryAt(attemptsDone: number, now: Date): Date {
  return new Date(now.getTime() + payoutRetryDelayMs(attemptsDone));
}

/** Filtre Prisma « rejeu dû » : champ absent (versements d'avant C-PR5) OU null OU échu. */
export function payoutRetryDueFilter(now: Date): { OR: Array<Record<string, unknown>> } {
  return { OR: [{ payoutNextRetryAt: { isSet: false } }, { payoutNextRetryAt: null }, { payoutNextRetryAt: { lte: now } }] };
}

/* ── Nature d'un échec ─────────────────────────────────────── */

export function payoutFailureKind(payoutStatus: string | null | undefined, reason: string | null | undefined): PayoutFailureKind | null {
  if (payoutStatus === "REVERSED") return "REVERSED";
  if (payoutStatus !== "FAILED") return null;
  if (reason === "CARRIER_ACCOUNT_NOT_READY") return "ACCOUNT_NOT_READY";
  return "PROVIDER_ERROR";
}

/** Le message fournisseur (après `PROVIDER_ERROR:`) — pour l'admin seulement (A75). */
export function payoutFailureDetail(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason.startsWith("PROVIDER_ERROR:")) return reason.slice("PROVIDER_ERROR:".length).trim() || null;
  if (reason === "CARRIER_ACCOUNT_NOT_READY" || reason === "PROVIDER_REVERSED") return null;
  return reason;
}

/* ── Chronologie de l'argent ───────────────────────────────── */

export type MoneyTimelineInput = {
  requestedAt: Date;
  capturedAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
  disputedAt?: Date | null;
  disputeTicket?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  closedAt?: Date | null;
  closedBy?: string | null;
  status: string;
  payoutStatus?: string | null;
  payoutAmountCents?: number | null;
  payoutSentAt?: Date | null;
  payoutLastAttemptAt?: Date | null;
  payoutFailureReason?: string | null;
  payoutReversalResolution?: string | null;
  payoutReversalResolvedAt?: Date | null;
  retentionCents?: number | null;
  retentionDisposition?: string | null;
  retentionDecidedAt?: Date | null;
  updatedAt?: Date | null;
  pricing: { totalShipperCents: number; transportCents: number };
};

/** Une ligne par fait d'argent posé en base, triée par date. Rien n'est inféré : un champ absent = pas de ligne. */
export function buildMoneyTimeline(b: MoneyTimelineInput): MoneyTimelineEvent[] {
  const out: MoneyTimelineEvent[] = [];
  const push = (at: Date | null | undefined, kind: MoneyTimelineEvent["kind"], amountCents: number | null, detail: string | null) => {
    if (at) out.push({ at: at.toISOString(), kind, amountCents, detail });
  };
  push(b.requestedAt, "AUTHORIZED", b.pricing.totalShipperCents, null);
  push(b.capturedAt, "CAPTURED", b.pricing.totalShipperCents, null);
  push(b.disputedAt, "DISPUTED", null, b.disputeTicket ?? null);
  push(b.refundedAt, "REFUNDED", b.refundAmountCents ?? null, null);
  if (b.status === "COMPLETED") push(b.completedAt, "COMPLETED", null, b.completedBy ?? null);
  if (b.status === "CANCELLED") push(b.closedAt, "CANCELLED", null, b.closedBy ?? null);
  if ((b.retentionCents ?? 0) > 0) {
    push(b.closedAt, "RETENTION", b.retentionCents ?? null, b.retentionDisposition ?? null);
    push(b.retentionDecidedAt, "RETENTION_DECIDED", b.retentionCents ?? null, b.retentionDisposition ?? null);
  }
  if (b.payoutStatus === "SENT" || b.payoutStatus === "REVERSED") push(b.payoutSentAt, "PAYOUT_SENT", b.payoutAmountCents ?? null, null);
  if (b.payoutStatus === "FAILED") push(b.payoutLastAttemptAt ?? b.updatedAt, "PAYOUT_FAILED", b.payoutAmountCents ?? null, payoutFailureKind(b.payoutStatus, b.payoutFailureReason));
  if (b.payoutStatus === "REVERSED") push(b.updatedAt, "PAYOUT_REVERSED", b.payoutAmountCents ?? null, null);
  if (b.payoutReversalResolution) push(b.payoutReversalResolvedAt, "REVERSAL_RESOLVED", null, b.payoutReversalResolution);
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

/* ── Rapprochement (A112) ──────────────────────────────────── */

export type ReconciliationDbState = {
  capturedAt: Date | null;
  refundAmountCents: number | null;
  payoutStatus: string | null;
  payoutAmountCents: number | null;
  transferId: string | null;
};

export type Divergence = { code: ReconciliationDivergenceCode; message: string; dbCents: number | null; liveCents: number | null };

/** Compare ce que la base croit à ce que le fournisseur dit. Ne décide rien : liste. */
export function reconcile(db: ReconciliationDbState, live: PaymentInspection): Divergence[] {
  const out: Divergence[] = [];
  const liveCaptured = live.status === "CAPTURED" || live.amountReceivedCents > 0;
  if (liveCaptured && !db.capturedAt) {
    out.push({ code: "CAPTURE_NOT_RECORDED", message: "Payment captured at the provider but not recorded.", dbCents: null, liveCents: live.amountReceivedCents });
  }
  if (!liveCaptured && db.capturedAt) {
    out.push({ code: "CAPTURE_RECORDED_NOT_LIVE", message: "Capture recorded but the provider shows no captured amount.", dbCents: live.amountCents, liveCents: 0 });
  }
  const liveRefunded = live.refunds.filter((r) => r.status !== "failed" && r.status !== "canceled").reduce((s, r) => s + r.amountCents, 0);
  const dbRefunded = db.refundAmountCents ?? 0;
  if (liveRefunded > dbRefunded) {
    out.push({ code: "REFUND_NOT_RECORDED", message: "The provider refunded more than the database records.", dbCents: dbRefunded, liveCents: liveRefunded });
  }
  if (dbRefunded > liveRefunded) {
    out.push({ code: "REFUND_RECORDED_NOT_LIVE", message: "A refund is recorded but the provider shows less (or none).", dbCents: dbRefunded, liveCents: liveRefunded });
  }
  const sentLike = db.payoutStatus === "SENT" || db.payoutStatus === "REVERSED";
  if (sentLike && !live.transfer) {
    out.push({ code: "TRANSFER_MISSING", message: "A transfer is recorded but the provider cannot find it.", dbCents: db.payoutAmountCents, liveCents: null });
  }
  if (live.transfer) {
    if (db.payoutAmountCents != null && live.transfer.amountCents !== db.payoutAmountCents) {
      out.push({ code: "TRANSFER_AMOUNT_MISMATCH", message: "Transfer amount differs from the recorded payout.", dbCents: db.payoutAmountCents, liveCents: live.transfer.amountCents });
    }
    if (live.transfer.reversedCents > 0 && db.payoutStatus === "SENT") {
      out.push({ code: "TRANSFER_REVERSED_NOT_MARKED", message: "The provider reversed this transfer but the payout is still SENT.", dbCents: db.payoutAmountCents, liveCents: live.transfer.reversedCents });
    }
    if (live.transfer.reversedCents === 0 && db.payoutStatus === "REVERSED") {
      out.push({ code: "TRANSFER_MARKED_REVERSED_BUT_LIVE_OK", message: "Marked REVERSED but the provider shows no reversal.", dbCents: db.payoutAmountCents, liveCents: 0 });
    }
  }
  return out;
}

/** Masque `acct_1ABC…XYZ` → `acct_…XYZ` (D56 4A : identifiant masqué hors finance de rapprochement). */
export function maskAccountId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.length <= 8 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`;
}
