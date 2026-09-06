/**
 * admin-finance.service.spec.ts — files, fiche argent, rapprochement, rejeu, renversements (C-PR5a, D58)
 * ======================================================================================================
 * prisma mocké, FakePaymentProvider réel (le rapprochement lit son état), exécuteur de versement mocké
 * (c'est lui qui est testé dans deal-settlement.service.spec — ici on vérifie qu'on passe PAR lui).
 */
const prismaMock = {
  booking: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  user: { findMany: jest.fn() },
  carrierPage: { findMany: jest.fn() },
  adminAction: { findMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
const recordAdminAction = jest.fn();
jest.mock("@packages/admin-audit", () => ({ recordAdminAction: (...a: unknown[]) => recordAdminAction(...a) }), { virtual: true });

import { ForbiddenError, ValidationError } from "@packages/error-handler";
import { FakePaymentProvider } from "@packages/payments";
import { makeAdminFinanceService } from "./admin-finance.service";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const ID = "64b0000000000000000000b1";
const SHIPPER_ID = "64b0000000000000000000e1";
const CARRIER_ID = "64b0000000000000000000c1";
const ADMIN = { id: "64b0000000000000000000ad", ip: null, userAgent: null };

function record(o: Record<string, unknown> = {}) {
  return {
    id: ID, tripId: "64b0000000000000000000a1", shipperId: SHIPPER_ID, carrierId: CARRIER_ID, status: "COMPLETED", isDeleted: false,
    expiresAt: NOW, acceptedAt: NOW, pickedUpAt: NOW, paymentIntentId: "pi_1", paymentProvider: "FAKE", chargeId: "ch_1",
    trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: NOW, originCountryCode: "FR", destinationCountryCode: "CG", originTimezone: "Europe/Paris", destinationTimezone: "Africa/Brazzaville", transportMode: "PLANE" },
    pricing: { pricingModel: "PER_KG", weightKg: 2, transportCents: 2000, commissionCents: 957, premiumCents: 0, totalShipperCents: 2957, currencyCode: "EUR" },
    parcel: { category: "BOOKS" }, pickup: null, trackingEvents: [], deliveryCodeHash: null, deliveryAttempts: 0, deliveryLockedUntil: null, codeRegenerations: 0,
    requestedAt: NOW, capturedAt: NOW, completedAt: NOW, completedBy: "SYSTEM", payoutStatus: "FAILED", payoutAmountCents: 2000, payoutAttempts: 3,
    payoutFailureReason: "PROVIDER_ERROR:balance insufficient", payoutLastAttemptAt: NOW, payoutNextRetryAt: NOW, updatedAt: NOW,
    ...o,
  };
}

const settlement = { executePayout: jest.fn() } as never;
const makeService = (provider = new FakePaymentProvider()) => makeAdminFinanceService(provider, settlement, () => NOW);

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: SHIPPER_ID, firstName: "Aminata", lastName: "Diallo" }, { id: CARRIER_ID, firstName: "Thomas", lastName: "Nkounkou" }]);
  prismaMock.carrierPage.findMany.mockResolvedValue([{ userId: CARRIER_ID, stripeAccountId: "acct_1ABCDEFGHIJKLMNO", stripePayoutsEnabled: true }]);
  prismaMock.adminAction.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) => fn(prismaMock));
});

describe("listQueue (2A)", () => {
  it("FAILED : versements en échec, nature et message brut pour l'admin, compte Stripe prêt ou non", async () => {
    prismaMock.booking.findMany.mockResolvedValue([record()]);
    const q = await makeService().listQueue("FAILED");
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toEqual({ isDeleted: false, status: { in: ["COMPLETED", "CANCELLED"] }, payoutStatus: "FAILED" });
    expect(q.items[0]).toMatchObject({ kind: "FAILED", amountCents: 2000, payoutFailureKind: "PROVIDER_ERROR", payoutFailureDetail: "balance insufficient", carrier: { firstName: "Thomas", stripeReady: true } });
  });
  it("REVERSED : seulement les renversements non clos (absent OU null) ; HELD : retenues à arbitrer, montant = retenue", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    await makeService().listQueue("REVERSED");
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toEqual({ isDeleted: false, payoutStatus: "REVERSED", OR: [{ payoutReversalResolution: { isSet: false } }, { payoutReversalResolution: null }] });
    prismaMock.booking.findMany.mockResolvedValue([record({ status: "CANCELLED", payoutStatus: null, retentionCents: 1478, retentionDisposition: "HELD_FOR_MEDIATION" })]);
    const q = await makeService().listQueue("HELD");
    expect(q.items[0]).toMatchObject({ kind: "HELD", amountCents: 1478, carrier: { stripeReady: null } });
  });
});

describe("getMoneyFile (4A)", () => {
  it("sert la fiche, masque le compte Stripe, calcule allowedActions et journalise DEAL_MONEY_VIEWED", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record());
    const f = await makeService().getMoneyFile(ADMIN, ID);
    expect(f.carrier.stripeAccountIdMasked).toBe("acct_…LMNO");
    expect(f.payout).toMatchObject({ status: "FAILED", failureKind: "PROVIDER_ERROR", attempts: 3 });
    expect(f.allowedActions).toEqual({ retryPayout: true, resolveReversal: false, reconcile: true, proposeRefund: true, applyRefund: true });
    expect(f.timeline.map((e) => e.kind)).toEqual(["AUTHORIZED", "CAPTURED", "COMPLETED", "PAYOUT_FAILED"]);
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "DEAL_MONEY_VIEWED", targetType: "BOOKING", targetId: ID }));
  });
  it("une partie au deal ne voit aucun geste ; un renversement ouvert propose sa clôture", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "REVERSED", payoutFailureReason: "PROVIDER_REVERSED" }));
    const f = await makeService().getMoneyFile({ ...ADMIN, id: CARRIER_ID }, ID);
    expect(f.allowedActions).toEqual({ retryPayout: false, resolveReversal: false, reconcile: true, proposeRefund: false, applyRefund: false });
    const g = await makeService().getMoneyFile(ADMIN, ID);
    expect(g.allowedActions.resolveReversal).toBe(true);
  });
});

describe("reconcileDeal (A112) — lecture seule", () => {
  it("un remboursement parti chez le fournisseur mais absent de la base est signalé ; journal DEAL_RECONCILED avec les codes", async () => {
    const provider = new FakePaymentProvider();
    const a = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    await provider.capture(a.intentId);
    await provider.refund(a.intentId, 1479);
    prismaMock.booking.findUnique.mockResolvedValue(record({ paymentIntentId: a.intentId, payoutStatus: null, payoutAmountCents: null, refundAmountCents: null }));
    const r = await makeService(provider).reconcileDeal(ADMIN, ID);
    expect(r.divergences.map((d) => d.code)).toEqual(["REFUND_NOT_RECORDED"]);
    expect(r.live?.amountReceivedCents).toBe(2957);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "DEAL_RECONCILED", after: { provider: "FAKE", divergences: ["REFUND_NOT_RECORDED"] } }));
  });
  it("intent inconnu du fournisseur → divergence INTENT_NOT_FOUND, pas d'erreur", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ paymentIntentId: "pi_nope" }));
    const r = await makeService().reconcileDeal(ADMIN, ID);
    expect(r.live).toBeNull();
    expect(r.divergences[0].code).toBe("INTENT_NOT_FOUND");
  });
});

describe("retryPayout (3A-a) — par l'exécuteur unique", () => {
  it("passe par settlement.executePayout et journalise PAYOUT_RETRIED avec l'issue", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record());
    (settlement as { executePayout: jest.Mock }).executePayout.mockResolvedValue({ payoutStatus: "SENT", transferId: "tr_9", reason: null });
    const r = await makeService().retryPayout(ADMIN, ID);
    expect(r).toEqual({ payoutStatus: "SENT", reason: null, transferId: "tr_9" });
    expect((settlement as { executePayout: jest.Mock }).executePayout).toHaveBeenCalledWith(expect.objectContaining({ id: ID }), NOW);
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "PAYOUT_RETRIED", after: { outcome: "SENT", reason: null, transferId: "tr_9" } }));
  });
  it("partie au deal → 403 ; rien à rejouer (SENT) → 400", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record());
    await expect(makeService().retryPayout({ ...ADMIN, id: SHIPPER_ID }, ID)).rejects.toBeInstanceOf(ForbiddenError);
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "SENT" }));
    await expect(makeService().retryPayout(ADMIN, ID)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("resolveReversal (3A-b)", () => {
  it("RESENT : PENDING + nouvelle clé d'idempotence + clôture dans une transaction avec le journal, puis l'exécuteur", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "REVERSED" }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    (settlement as { executePayout: jest.Mock }).executePayout.mockResolvedValue({ payoutStatus: "SENT", transferId: "tr_10", reason: null });
    const r = await makeService().resolveReversal(ADMIN, ID, { outcome: "RESENT", reason: "Le Voyageur a corrigé son RIB, on renvoie." });
    expect(r).toEqual({ outcome: "RESENT", payoutStatus: "SENT", reason: null });
    const u = prismaMock.booking.updateMany.mock.calls[0][0];
    expect(u.where).toEqual({ id: ID, payoutStatus: "REVERSED", OR: [{ payoutReversalResolution: { isSet: false } }, { payoutReversalResolution: null }] });
    expect(u.data).toMatchObject({ payoutStatus: "PENDING", payoutIdempotencyKey: `payout:${ID}:resend:${NOW.getTime()}`, payoutReversalResolution: "RESENT", payoutReversalResolvedByAdminId: ADMIN.id });
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "PAYOUT_REVERSAL_RESOLVED", after: expect.objectContaining({ outcome: "RESENT" }) }));
    expect((settlement as { executePayout: jest.Mock }).executePayout).toHaveBeenCalledTimes(1);
  });
  it("WRITTEN_OFF : clôture seule, rien n'est renvoyé ; déjà clos → 400", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "REVERSED" }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    const r = await makeService().resolveReversal(ADMIN, ID, { outcome: "WRITTEN_OFF", reason: "Compte fermé, Voyageur injoignable depuis 60 jours." });
    expect(r).toEqual({ outcome: "WRITTEN_OFF", payoutStatus: "REVERSED", reason: null });
    expect(prismaMock.booking.updateMany.mock.calls[0][0].data).not.toHaveProperty("payoutStatus");
    expect((settlement as { executePayout: jest.Mock }).executePayout).not.toHaveBeenCalled();
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(makeService().resolveReversal(ADMIN, ID, { outcome: "WRITTEN_OFF", reason: "Compte fermé, Voyageur injoignable depuis 60 jours." })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("C-PR5b — rapport, export journalisé, remboursement manuel", () => {
  it("getReport : deux lectures (faits datés depuis le début de période, passifs du jour), agrégats purs", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([record({ capturedAt: new Date("2026-08-20T10:00:00Z"), completedAt: new Date("2026-09-02T10:00:00Z"), payoutStatus: "SENT", payoutSentAt: new Date("2026-09-02T10:01:00Z") })]);
    prismaMock.booking.findMany.mockResolvedValueOnce([record({ payoutStatus: "FAILED" })]);
    const r = await makeService().getReport(3);
    expect(r.from).toBe("2026-07-01T00:00:00.000Z");
    expect(r.to).toBe("2026-10-01T00:00:00.000Z");
    expect(r.months.map((m) => m.month)).toEqual(["2026-09", "2026-08"]);
    expect(r.months[0]).toMatchObject({ revenueCents: 957, paidOutCents: 2000 });
    expect(r.snapshot).toEqual([{ currencyCode: "EUR", pendingPayoutCents: 2000, frozenPayoutCents: 0, reversedOpenCents: 0, heldRetentionCents: 0, proposedRefundCents: 0 }]);
    expect(prismaMock.booking.findMany.mock.calls[0][0].where.OR[0]).toEqual({ capturedAt: { gte: new Date("2026-07-01T00:00:00.000Z") } });
  });
  it("exportCsv : période bornée, lignes filtrées par fait d'argent, journal FINANCE_EXPORTED avec le nombre de lignes", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      record({ capturedAt: new Date("2026-08-20T10:00:00Z"), completedAt: new Date("2026-09-02T10:00:00Z") }),
      record({ id: "64b0000000000000000000b2", capturedAt: new Date("2026-05-01T10:00:00Z"), completedAt: new Date("2026-05-05T10:00:00Z") }),
    ]);
    const out = await makeService().exportCsv(ADMIN, new Date("2026-09-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
    expect(out.rows).toBe(1);
    expect(out.filename).toBe("yamba-finances-2026-09-01-2026-10-01.csv");
    expect(out.csv.split("\r\n")[1]).toContain(`${ID},COMPLETED,Paris,Brazzaville`);
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "FINANCE_EXPORTED", after: expect.objectContaining({ rows: 1 }) }));
    await expect(makeService().exportCsv(ADMIN, new Date("2025-01-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"))).rejects.toBeInstanceOf(ValidationError);
    await expect(makeService().exportCsv(ADMIN, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"))).rejects.toBeInstanceOf(ValidationError);
  });
  const REASON = "Geste commercial : colis livré avec 3 jours de retard, plainte fondée de l'Expéditeur.";
  it("proposeManualRefund : borné au restant remboursable, partie → 403, écrit la proposition + journal dans une transaction", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "SENT", refundAmountCents: 1000 }));
    prismaMock.booking.update = jest.fn().mockResolvedValue({});
    await expect(makeService().proposeManualRefund(ADMIN, ID, { amountCents: 2000, reason: REASON })).rejects.toThrow(/At most 1957/);
    await expect(makeService().proposeManualRefund({ ...ADMIN, id: SHIPPER_ID }, ID, { amountCents: 500, reason: REASON })).rejects.toBeInstanceOf(ForbiddenError);
    const r = await makeService().proposeManualRefund(ADMIN, ID, { amountCents: 500, reason: REASON });
    expect(r.proposedAt).toBe(NOW.toISOString());
    expect((prismaMock.booking.update as jest.Mock).mock.calls[0][0].data).toMatchObject({ manualRefundProposedCents: 500, manualRefundProposedByAdminId: ADMIN.id });
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "REFUND_MANUAL_PROPOSED", after: { amountCents: 500, reason: REASON } }));
  });
  it("applyManualRefund : l'argent d'abord (D39), puis cumul + refundId + outbox refund_issued (ADMIN) + journal dans la transaction ; verrou sur le cumul", async () => {
    const provider = new FakePaymentProvider();
    const a = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    await provider.capture(a.intentId);
    prismaMock.booking.findUnique.mockResolvedValue(record({ paymentIntentId: a.intentId, payoutStatus: "SENT", refundAmountCents: null, expiresAt: NOW, parcel: { category: "BOOKS", categoryFamily: null } }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.outboxEvent = { create: jest.fn().mockResolvedValue({}) } as never;
    const r = await makeService(provider).applyManualRefund(ADMIN, ID, { amountCents: 500, reason: REASON });
    expect(r).toMatchObject({ bookingId: ID, refundedCents: 500, totalRefundedCents: 500, currencyCode: "EUR" });
    expect(r.refundId).toMatch(/^re_fake_/);
    const u = prismaMock.booking.updateMany.mock.calls[0][0];
    expect(u.where).toEqual({ id: ID, status: "COMPLETED", OR: [{ refundAmountCents: null }, { refundAmountCents: { isSet: false } }] });
    expect(u.data).toMatchObject({ refundAmountCents: 500, manualRefundCents: 500, manualRefundByAdminId: ADMIN.id, manualRefundProposedCents: null });
    const ev = (prismaMock.outboxEvent as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(ev.eventType).toBe("booking.refund_issued");
    const stored = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
    expect(stored.payload).toMatchObject({ actor: "ADMIN", amountCents: 500, refundedAt: NOW.toISOString() });
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "REFUND_MANUAL_APPLIED", after: expect.objectContaining({ totalRefundedCents: 500 }) }));
    expect((await provider.inspect({ intentId: a.intentId })).refunds).toHaveLength(1);
  });
  it("applyManualRefund : deal non fermé (DISPUTED) → 400 avant tout appel fournisseur", async () => {
    const provider = new FakePaymentProvider();
    const spy = jest.spyOn(provider, "refund");
    prismaMock.booking.findUnique.mockResolvedValue(record({ status: "DISPUTED", payoutStatus: "FROZEN" }));
    await expect(makeService(provider).applyManualRefund(ADMIN, ID, { amountCents: 100, reason: REASON })).rejects.toBeInstanceOf(ValidationError);
    expect(spy).not.toHaveBeenCalled();
  });
});
