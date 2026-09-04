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
    parcel: { category: "OTHER" }, pickup: null, trackingEvents: [], deliveryCodeHash: null, deliveryAttempts: 0, deliveryLockedUntil: null, codeRegenerations: 0,
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
    expect(f.allowedActions).toEqual({ retryPayout: true, resolveReversal: false, reconcile: true });
    expect(f.timeline.map((e) => e.kind)).toEqual(["AUTHORIZED", "CAPTURED", "COMPLETED", "PAYOUT_FAILED"]);
    expect(recordAdminAction).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ action: "DEAL_MONEY_VIEWED", targetType: "BOOKING", targetId: ID }));
  });
  it("une partie au deal ne voit aucun geste ; un renversement ouvert propose sa clôture", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(record({ payoutStatus: "REVERSED", payoutFailureReason: "PROVIDER_REVERSED" }));
    const f = await makeService().getMoneyFile({ ...ADMIN, id: CARRIER_ID }, ID);
    expect(f.allowedActions).toEqual({ retryPayout: false, resolveReversal: false, reconcile: true });
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
