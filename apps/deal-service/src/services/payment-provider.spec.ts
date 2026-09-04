/**
 * payment-provider.spec.ts — le fournisseur Fake (D11/D30) et le factory
 */
import { FakePaymentProvider, createPaymentProviderFromEnv } from "@packages/payments";

describe("FakePaymentProvider", () => {
  it("authorize → AUTHORIZED immédiatement, métadonnées conservées, sans clientSecret", async () => {
    const p = new FakePaymentProvider();
    const a = await p.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: { tripId: "x" } });
    expect(a.provider).toBe("FAKE");
    expect(a.status).toBe("AUTHORIZED");
    expect(a.clientSecret).toBeNull();
    expect((await p.retrieve(a.intentId)).metadata).toEqual({ tripId: "x" });
  });
  it("capture / cancel changent l'état ; intent inconnu → erreur", async () => {
    const p = new FakePaymentProvider();
    const a = await p.authorize({ amountCents: 100, currencyCode: "EUR", description: "t", metadata: {} });
    expect((await p.capture(a.intentId)).status).toBe("CAPTURED");
    const b = await p.authorize({ amountCents: 100, currencyCode: "EUR", description: "t", metadata: {} });
    expect((await p.cancel(b.intentId)).status).toBe("CANCELED");
    await expect(p.retrieve("pi_nope")).rejects.toThrow(/Unknown/);
  });
  it("refund total par défaut, partiel si montant fourni", async () => {
    const p = new FakePaymentProvider();
    const a = await p.authorize({ amountCents: 500, currencyCode: "EUR", description: "t", metadata: {} });
    expect((await p.refund(a.intentId)).amountCents).toBe(500);
    expect((await p.refund(a.intentId, 200)).amountCents).toBe(200);
  });
});

describe("FakePaymentProvider — versement B4 (D49/A69)", () => {
  it("capture pose un chargeId (A69) ; l'autorisation n'en a pas", async () => {
    const provider = new FakePaymentProvider();
    const auth = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    expect(auth.chargeId).toBeNull();
    const captured = await provider.capture(auth.intentId);
    expect(captured.chargeId).toBe(`ch_fake_${auth.intentId}`);
    expect((await provider.retrieve(auth.intentId)).chargeId).toBe(`ch_fake_${auth.intentId}`);
  });

  it("transfer : observable, clé d'idempotence honorée (même clé ⇒ même transfert), clés différentes ⇒ deux transferts", async () => {
    const provider = new FakePaymentProvider();
    const input = { amountCents: 2400, currencyCode: "EUR", destinationAccountId: "acct_fake", description: "t", metadata: {}, idempotencyKey: "payout:b1" };
    const a = await provider.transfer(input);
    const b = await provider.transfer(input);
    expect(a).toEqual(b);
    expect(a.transferId).toMatch(/^tr_fake_/);
    expect(a).toMatchObject({ provider: "FAKE", amountCents: 2400, currencyCode: "EUR" });
    expect(provider.transfers).toHaveLength(1);
    await provider.transfer({ ...input, idempotencyKey: "payout:b2" });
    expect(provider.transfers).toHaveLength(2);
  });
});

describe("createPaymentProviderFromEnv", () => {
  it("sans clé hors production → FAKE", () => {
    expect(createPaymentProviderFromEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv).name).toBe("FAKE");
  });
  it("sans clé en production → refuse de démarrer", () => {
    expect(() => createPaymentProviderFromEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/STRIPE_SECRET_KEY/);
  });
  it("avec clé → STRIPE", () => {
    expect(createPaymentProviderFromEnv({ STRIPE_SECRET_KEY: "sk_test_x" } as NodeJS.ProcessEnv).name).toBe("STRIPE");
  });
  it("C-PR5 (D58) : inspect reflète capture, remboursements et transfert (renversement simulable), lecture seule", async () => {
    const p = new FakePaymentProvider();
    const a = await p.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    let i = await p.inspect({ intentId: a.intentId });
    expect(i).toMatchObject({ provider: "FAKE", status: "AUTHORIZED", amountReceivedCents: 0, refunds: [], transfer: null });
    await p.capture(a.intentId);
    await p.refund(a.intentId, 500);
    const t = await p.transfer({ amountCents: 2000, currencyCode: "EUR", destinationAccountId: "acct_x", description: "t", metadata: {}, idempotencyKey: "k" });
    i = await p.inspect({ intentId: a.intentId, transferId: t.transferId });
    expect(i.amountReceivedCents).toBe(2957);
    expect(i.refunds).toEqual([expect.objectContaining({ amountCents: 500, status: "succeeded" })]);
    expect(i.transfer).toMatchObject({ id: t.transferId, amountCents: 2000, reversedCents: 0 });
    p._reverseTransferForTest(t.transferId);
    expect((await p.inspect({ intentId: a.intentId, transferId: t.transferId })).transfer?.reversedCents).toBe(2000);
    expect((await p.inspect({ intentId: a.intentId, transferId: "tr_unknown" })).transfer).toBeNull();
    await expect(p.inspect({ intentId: "pi_nope" })).rejects.toThrow(/Unknown/);
  });
});
