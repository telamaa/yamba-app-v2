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

/* ══ C-PR5b (D58 5A) — rapport mensuel par devise, pur ═══════ */

export type FinanceReportRow = {
  id: string;
  status: string;
  pricing: { totalShipperCents: number; transportCents: number; commissionCents: number; premiumCents: number; currencyCode: string };
  capturedAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
  payoutStatus?: string | null;
  payoutAmountCents?: number | null;
  payoutSentAt?: Date | null;
  payoutReversalResolution?: string | null;
  completedAt?: Date | null;
  closedAt?: Date | null;
  retentionCents?: number | null;
  retentionDisposition?: string | null;
  manualRefundProposedCents?: number | null;
};

export type FinanceReportMonthRow = {
  month: string; currencyCode: string;
  capturedCents: number; capturedCount: number; refundedCents: number; refundCount: number;
  paidOutCents: number; payoutCount: number; revenueCents: number; completedCount: number; retentionCents: number; cancelledCount: number;
};
export type FinanceSnapshotRow = { currencyCode: string; pendingPayoutCents: number; frozenPayoutCents: number; reversedOpenCents: number; heldRetentionCents: number; proposedRefundCents: number };

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const inRange = (d: Date | null | undefined, from: Date, to: Date) => !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();

/** Début du mois UTC, `monthsBack` mois avant `now` (0 = mois courant). */
export function monthStartUtc(now: Date, monthsBack: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
}

/**
 * Agrège les faits d'argent par mois (UTC) et par devise. Chaque fait est daté par SON champ :
 * capture → capturedAt, remboursement → refundedAt, versement → payoutSentAt, revenu → completedAt,
 * retenue → closedAt. Un deal peut donc compter dans plusieurs mois (capturé en mars, terminé en avril).
 * Aucun frais fournisseur ici (pas en base) : le comptable rapproche avec l'export Stripe.
 */
export function buildFinanceReport(rows: FinanceReportRow[], from: Date, to: Date): FinanceReportMonthRow[] {
  const byKey = new Map<string, FinanceReportMonthRow>();
  const get = (d: Date, currencyCode: string) => {
    const month = monthKey(d);
    const k = `${month}|${currencyCode}`;
    let m = byKey.get(k);
    if (!m) {
      m = { month, currencyCode, capturedCents: 0, capturedCount: 0, refundedCents: 0, refundCount: 0, paidOutCents: 0, payoutCount: 0, revenueCents: 0, completedCount: 0, retentionCents: 0, cancelledCount: 0 };
      byKey.set(k, m);
    }
    return m;
  };
  for (const r of rows) {
    const cur = r.pricing.currencyCode;
    if (inRange(r.capturedAt, from, to)) {
      const m = get(r.capturedAt!, cur);
      m.capturedCents += r.pricing.totalShipperCents;
      m.capturedCount += 1;
    }
    if (inRange(r.refundedAt, from, to) && (r.refundAmountCents ?? 0) > 0) {
      const m = get(r.refundedAt!, cur);
      m.refundedCents += r.refundAmountCents ?? 0;
      m.refundCount += 1;
    }
    if ((r.payoutStatus === "SENT" || r.payoutStatus === "REVERSED") && inRange(r.payoutSentAt, from, to)) {
      const m = get(r.payoutSentAt!, cur);
      m.paidOutCents += r.payoutAmountCents ?? 0;
      m.payoutCount += 1;
    }
    if (r.status === "COMPLETED" && inRange(r.completedAt, from, to)) {
      const m = get(r.completedAt!, cur);
      m.revenueCents += r.pricing.commissionCents + r.pricing.premiumCents;
      m.completedCount += 1;
    }
    if (r.status === "CANCELLED" && inRange(r.closedAt, from, to)) {
      const m = get(r.closedAt!, cur);
      m.cancelledCount += 1;
      m.retentionCents += r.retentionCents ?? 0;
    }
  }
  return [...byKey.values()].sort((a, b) => b.month.localeCompare(a.month) || a.currencyCode.localeCompare(b.currencyCode));
}

/** Ce qui est dû, gelé, revenu ou proposé AUJOURD'HUI, par devise (passifs — jamais un revenu). */
export function buildFinanceSnapshot(rows: FinanceReportRow[]): FinanceSnapshotRow[] {
  const byCur = new Map<string, FinanceSnapshotRow>();
  const get = (currencyCode: string) => {
    let s = byCur.get(currencyCode);
    if (!s) {
      s = { currencyCode, pendingPayoutCents: 0, frozenPayoutCents: 0, reversedOpenCents: 0, heldRetentionCents: 0, proposedRefundCents: 0 };
      byCur.set(currencyCode, s);
    }
    return s;
  };
  for (const r of rows) {
    const s = get(r.pricing.currencyCode);
    const payout = r.payoutAmountCents ?? r.pricing.transportCents;
    if (r.payoutStatus === "PENDING" || r.payoutStatus === "FAILED") s.pendingPayoutCents += payout;
    if (r.payoutStatus === "FROZEN") s.frozenPayoutCents += payout;
    if (r.payoutStatus === "REVERSED" && !r.payoutReversalResolution) s.reversedOpenCents += payout;
    if (r.status === "CANCELLED" && r.retentionDisposition === "HELD_FOR_MEDIATION") s.heldRetentionCents += r.retentionCents ?? 0;
    if ((r.manualRefundProposedCents ?? 0) > 0) s.proposedRefundCents += r.manualRefundProposedCents ?? 0;
  }
  return [...byCur.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

/* ══ C-PR5b — export CSV par deal, pur ═══════════════════════ */

export type FinanceCsvRow = FinanceReportRow & {
  shipperId: string;
  carrierId: string;
  trip: { originCity: string; destinationCity: string; departureAt: Date };
  paymentIntentId?: string | null;
  chargeId?: string | null;
  refundId?: string | null;
  transferId?: string | null;
  disputeTicket?: string | null;
  completedBy?: string | null;
  closedBy?: string | null;
};

export const FINANCE_CSV_COLUMNS = [
  "dealId", "status", "originCity", "destinationCity", "departureAt", "shipperId", "carrierId", "currency",
  "totalShipperCents", "transportCents", "commissionCents", "premiumCents",
  "capturedAt", "refundAmountCents", "refundedAt", "refundId",
  "payoutStatus", "payoutAmountCents", "payoutSentAt", "transferId",
  "retentionCents", "retentionDisposition", "completedAt", "completedBy", "closedAt", "closedBy",
  "disputeTicket", "paymentIntentId", "chargeId",
] as const;

/** Une cellule CSV : guillemets doublés, virgule / retour à la ligne / guillemet ⇒ encadrée. Un préfixe de formule est neutralisé (injection tableur). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Un deal entre dans l'export si l'un de ses faits d'argent tombe dans la période. */
export function csvRowInRange(r: FinanceCsvRow, from: Date, to: Date): boolean {
  return inRange(r.capturedAt, from, to) || inRange(r.refundedAt, from, to) || inRange(r.payoutSentAt, from, to) || inRange(r.completedAt, from, to) || inRange(r.closedAt, from, to);
}

export function buildFinanceCsv(rows: FinanceCsvRow[]): string {
  const lines = [FINANCE_CSV_COLUMNS.join(",")];
  for (const r of rows) {
    const cells: unknown[] = [
      r.id, r.status, r.trip.originCity, r.trip.destinationCity, r.trip.departureAt, r.shipperId, r.carrierId, r.pricing.currencyCode,
      r.pricing.totalShipperCents, r.pricing.transportCents, r.pricing.commissionCents, r.pricing.premiumCents,
      r.capturedAt, r.refundAmountCents, r.refundedAt, r.refundId,
      r.payoutStatus, r.payoutAmountCents, r.payoutSentAt, r.transferId,
      r.retentionCents, r.retentionDisposition, r.completedAt, r.completedBy, r.closedAt, r.closedBy,
      r.disputeTicket, r.paymentIntentId, r.chargeId,
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/* ══ C-PR5b (D58 3A-c) — remboursement manuel : bornes, pur ══ */

export type ManualRefundBounds = { maxRefundableCents: number; allowed: boolean; reason: string | null };

/**
 * Un geste commercial ne s'applique qu'à un deal FERMÉ (COMPLETED ou CANCELLED) dont l'argent a été capturé ;
 * un litige ouvert (DISPUTED) se règle par la médiation, un deal en cours par son cycle de vie.
 * Le plafond est le total payé moins ce qui a déjà été remboursé (toutes causes).
 */
export function manualRefundBounds(b: { status: string; capturedAt?: Date | null; paymentIntentId?: string | null; refundAmountCents?: number | null; pricing: { totalShipperCents: number } }): ManualRefundBounds {
  const maxRefundableCents = Math.max(0, b.pricing.totalShipperCents - (b.refundAmountCents ?? 0));
  if (b.status !== "COMPLETED" && b.status !== "CANCELLED") return { maxRefundableCents, allowed: false, reason: "Only a closed deal (COMPLETED or CANCELLED) can receive a commercial refund." };
  if (!b.capturedAt || !b.paymentIntentId) return { maxRefundableCents: 0, allowed: false, reason: "Nothing was captured on this deal." };
  if (maxRefundableCents <= 0) return { maxRefundableCents: 0, allowed: false, reason: "This deal is already fully refunded." };
  return { maxRefundableCents, allowed: true, reason: null };
}
