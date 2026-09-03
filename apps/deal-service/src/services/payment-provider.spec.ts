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
});
