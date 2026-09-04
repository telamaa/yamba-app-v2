import { buildMoneyTimeline, maskAccountId, nextPayoutRetryAt, payoutFailureDetail, payoutFailureKind, payoutRetryDelayMs, payoutRetryDueFilter, reconcile } from "./admin-finance.rules";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const live = (o: Partial<Parameters<typeof reconcile>[1]> = {}) => ({
  provider: "FAKE" as const,
  intentId: "pi_1",
  status: "CAPTURED" as const,
  amountCents: 2957,
  amountReceivedCents: 2957,
  chargeId: "ch_1",
  refunds: [],
  transfer: null,
  ...o,
});
const db = (o: Partial<Parameters<typeof reconcile>[0]> = {}) => ({ capturedAt: NOW, refundAmountCents: null, payoutStatus: null, payoutAmountCents: null, transferId: null, ...o });

describe("admin-finance.rules (C-PR5a, D58)", () => {
  it("A111 : rejeux espacés — 5 min ×6, 30 min ×6, 2 h ×12, puis quotidien, jamais de plafond", () => {
    expect(payoutRetryDelayMs(0)).toBe(5 * 60_000);
    expect(payoutRetryDelayMs(5)).toBe(5 * 60_000);
    expect(payoutRetryDelayMs(6)).toBe(30 * 60_000);
    expect(payoutRetryDelayMs(12)).toBe(2 * 3_600_000);
    expect(payoutRetryDelayMs(24)).toBe(24 * 3_600_000);
    expect(payoutRetryDelayMs(1000)).toBe(24 * 3_600_000);
    expect(nextPayoutRetryAt(1, NOW).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });
  it("payoutRetryDueFilter : absent OU null OU échu (pitfall Mongo)", () => {
    expect(payoutRetryDueFilter(NOW)).toEqual({ OR: [{ payoutNextRetryAt: { isSet: false } }, { payoutNextRetryAt: null }, { payoutNextRetryAt: { lte: NOW } }] });
  });
  it("payoutFailureKind / detail : compte non prêt, fournisseur, renversé ; le message brut n'est servi qu'à l'admin", () => {
    expect(payoutFailureKind("FAILED", "CARRIER_ACCOUNT_NOT_READY")).toBe("ACCOUNT_NOT_READY");
    expect(payoutFailureKind("FAILED", "PROVIDER_ERROR:insufficient funds")).toBe("PROVIDER_ERROR");
    expect(payoutFailureKind("REVERSED", "PROVIDER_REVERSED")).toBe("REVERSED");
    expect(payoutFailureKind("SENT", null)).toBeNull();
    expect(payoutFailureDetail("PROVIDER_ERROR:insufficient funds")).toBe("insufficient funds");
    expect(payoutFailureDetail("CARRIER_ACCOUNT_NOT_READY")).toBeNull();
    expect(payoutFailureDetail(null)).toBeNull();
  });
  it("buildMoneyTimeline : une ligne par fait posé, triée ; rien d'inféré", () => {
    const t = buildMoneyTimeline({
      requestedAt: new Date("2026-09-01T10:00:00Z"),
      capturedAt: new Date("2026-09-01T12:00:00Z"),
      status: "COMPLETED",
      completedAt: new Date("2026-09-03T10:00:00Z"),
      completedBy: "SYSTEM",
      payoutStatus: "REVERSED",
      payoutAmountCents: 2000,
      payoutSentAt: new Date("2026-09-03T10:01:00Z"),
      updatedAt: new Date("2026-09-04T09:00:00Z"),
      payoutReversalResolution: "WRITTEN_OFF",
      payoutReversalResolvedAt: new Date("2026-09-04T09:30:00Z"),
      pricing: { totalShipperCents: 2957, transportCents: 2000 },
    });
    expect(t.map((e) => e.kind)).toEqual(["AUTHORIZED", "CAPTURED", "COMPLETED", "PAYOUT_SENT", "PAYOUT_REVERSED", "REVERSAL_RESOLVED"]);
    expect(t[3].amountCents).toBe(2000);
    expect(t[5].detail).toBe("WRITTEN_OFF");
    const cancelled = buildMoneyTimeline({
      requestedAt: new Date("2026-09-01T10:00:00Z"), capturedAt: new Date("2026-09-01T12:00:00Z"), status: "CANCELLED",
      closedAt: new Date("2026-09-02T10:00:00Z"), closedBy: "SHIPPER", refundedAt: new Date("2026-09-02T10:00:00Z"), refundAmountCents: 1479,
      retentionCents: 1478, retentionDisposition: "HELD_FOR_MEDIATION", pricing: { totalShipperCents: 2957, transportCents: 2000 },
    });
    expect(cancelled.map((e) => e.kind)).toEqual(["AUTHORIZED", "CAPTURED", "REFUNDED", "CANCELLED", "RETENTION"]);
    expect(buildMoneyTimeline({ requestedAt: new Date("2026-09-01T10:00:00Z"), status: "PENDING", pricing: { totalShipperCents: 1, transportCents: 1 } })).toHaveLength(1);
  });
  describe("reconcile (A112) : la base contre le fournisseur, sans rien décider", () => {
    it("tout concorde → aucune divergence", () => {
      expect(reconcile(db({ payoutStatus: "SENT", payoutAmountCents: 2000, transferId: "tr_1" }), live({ transfer: { id: "tr_1", amountCents: 2000, reversedCents: 0, createdAt: null } }))).toEqual([]);
    });
    it("remboursement parti chez le fournisseur mais non écrit (D39) → REFUND_NOT_RECORDED", () => {
      const d = reconcile(db(), live({ refunds: [{ id: "re_1", amountCents: 1479, status: "succeeded", createdAt: null }] }));
      expect(d.map((x) => x.code)).toEqual(["REFUND_NOT_RECORDED"]);
      expect(d[0]).toMatchObject({ dbCents: 0, liveCents: 1479 });
    });
    it("remboursement écrit mais absent ou échoué chez le fournisseur → REFUND_RECORDED_NOT_LIVE", () => {
      expect(reconcile(db({ refundAmountCents: 500 }), live({ refunds: [{ id: "re_1", amountCents: 500, status: "failed", createdAt: null }] })).map((x) => x.code)).toEqual(["REFUND_RECORDED_NOT_LIVE"]);
    });
    it("capture : non écrite ou écrite à tort", () => {
      expect(reconcile(db({ capturedAt: null }), live()).map((x) => x.code)).toEqual(["CAPTURE_NOT_RECORDED"]);
      expect(reconcile(db(), live({ status: "AUTHORIZED", amountReceivedCents: 0 })).map((x) => x.code)).toEqual(["CAPTURE_RECORDED_NOT_LIVE"]);
    });
    it("transfert : introuvable, montant différent, renversé non marqué, marqué renversé à tort", () => {
      expect(reconcile(db({ payoutStatus: "SENT", payoutAmountCents: 2000, transferId: "tr_1" }), live()).map((x) => x.code)).toEqual(["TRANSFER_MISSING"]);
      const tr = (amountCents: number, reversedCents: number) => ({ id: "tr_1", amountCents, reversedCents, createdAt: null });
      expect(reconcile(db({ payoutStatus: "SENT", payoutAmountCents: 2000, transferId: "tr_1" }), live({ transfer: tr(1900, 0) })).map((x) => x.code)).toEqual(["TRANSFER_AMOUNT_MISMATCH"]);
      expect(reconcile(db({ payoutStatus: "SENT", payoutAmountCents: 2000, transferId: "tr_1" }), live({ transfer: tr(2000, 2000) })).map((x) => x.code)).toEqual(["TRANSFER_REVERSED_NOT_MARKED"]);
      expect(reconcile(db({ payoutStatus: "REVERSED", payoutAmountCents: 2000, transferId: "tr_1" }), live({ transfer: tr(2000, 0) })).map((x) => x.code)).toEqual(["TRANSFER_MARKED_REVERSED_BUT_LIVE_OK"]);
    });
  });
  it("maskAccountId : début et fin seulement", () => {
    expect(maskAccountId("acct_1ABCDEFGHIJKLMNO")).toBe("acct_…LMNO");
    expect(maskAccountId(null)).toBeNull();
  });
});
