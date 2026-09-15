/**
 * refund-idempotency.spec.ts — une clé par geste de remboursement, honorée par le fournisseur (recette § 5.15, A165)
 */
import { FakePaymentProvider } from "@packages/payments";
import { refundIdempotencyKey } from "./refund-idempotency";

describe("refundIdempotencyKey (A165)", () => {
  it("décrit le geste : nature, deal, montant ; le remboursement manuel porte en plus le cumul lu avant le geste", () => {
    expect(refundIdempotencyKey("cancel", "d1", 1950)).toBe("yamba:refund:cancel:d1:1950");
    expect(refundIdempotencyKey("capture-rollback", "d1", "full")).toBe("yamba:refund:capture-rollback:d1:full");
    expect(refundIdempotencyKey("manual", "d1", 500, 0)).toBe("yamba:refund:manual:d1:after-0:500");
    expect(refundIdempotencyKey("manual", "d1", 500, 500)).not.toBe(refundIdempotencyKey("manual", "d1", 500, 0));
    expect(refundIdempotencyKey("dispute", "d1", 700)).not.toBe(refundIdempotencyKey("retention", "d1", 700));
  });

  it("le fournisseur Fake honore la clé comme Stripe : même clé → même remboursement ; clé oubliée → un second", async () => {
    const p = new FakePaymentProvider();
    const a = await p.authorize({ amountCents: 3000, currencyCode: "EUR", description: "t", metadata: {} });
    await p.capture(a.intentId);
    const cle = refundIdempotencyKey("manual", "d1", 500, 0);
    const r1 = await p.refund(a.intentId, 500, { idempotencyKey: cle });
    const r2 = await p.refund(a.intentId, 500, { idempotencyKey: cle });
    expect(r2.refundId).toBe(r1.refundId);
    expect((await p.inspect({ intentId: a.intentId })).refunds).toHaveLength(1);
    p._forgetIdempotencyKeysForTest();
    await p.refund(a.intentId, 500, { idempotencyKey: cle });
    expect((await p.inspect({ intentId: a.intentId })).refunds).toHaveLength(2);
  });
});
