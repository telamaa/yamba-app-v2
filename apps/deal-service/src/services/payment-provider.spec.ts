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
