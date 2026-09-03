/**
 * wallet.service.spec.ts — portefeuille Voyageur / paiements Expéditeur (A83)
 * ==========================================================================
 * Fonction pure : des enregistrements → totaux et lignes. Chaque état du
 * contrat a sa fixture ; les totaux sont vérifiés contre les lignes.
 */
import { CarrierWalletSchema, ShipperWalletSchema } from "@packages/api-contracts";
import { buildCarrierWallet, buildShipperWallet, toPayoutItem, toPaymentItem, type WalletBookingRecord } from "./wallet.service";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
let seq = 0;
function rec(o: Partial<WalletBookingRecord> & { status: string }): WalletBookingRecord {
  seq += 1;
  return {
    id: `64b00000000000000000${String(seq).padStart(4, "0")}`,
    tripId: "64b0000000000000000000a1",
    shipperId: "64b0000000000000000000e1",
    carrierId: "64b0000000000000000000c1",
    trip: { originCity: "Paris", destinationCity: "Brazzaville" },
    pricing: { transportCents: 2400, totalShipperCents: 2957, currencyCode: "EUR" },
    requestedAt: days(-10),
    updatedAt: days(-1),
    ...o,
  };
}
const counterparts = new Map([
  ["64b0000000000000000000e1", { firstName: "Naomi" }],
  ["64b0000000000000000000c1", { firstName: "Thomas" }],
]);

describe("Voyageur — toPayoutItem", () => {
  it("DELIVERED → UPCOMING (net, date = payoutDueAt) ; DISPUTED → FROZEN ; CANCELLED après départ → HELD sans montant", () => {
    expect(toPayoutItem(rec({ status: "DELIVERED", payoutDueAt: days(3) }), counterparts)).toMatchObject({ state: "UPCOMING", kind: "DELIVERY", amountCents: 2400, date: days(3).toISOString(), counterpartFirstName: "Naomi" });
    expect(toPayoutItem(rec({ status: "DISPUTED", payoutStatus: "FROZEN" }), counterparts)).toMatchObject({ state: "FROZEN", amountCents: 2400 });
    expect(toPayoutItem(rec({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", retentionCents: 1478 }), counterparts)).toMatchObject({ state: "HELD", kind: "LATE_CANCELLATION", amountCents: null });
  });

  it("COMPLETED : SENT / PENDING / BLOCKED (compte Stripe) / PENDING (autre erreur) ; antérieur à B4 sans versement → rien", () => {
    expect(toPayoutItem(rec({ status: "COMPLETED", payoutStatus: "SENT", payoutSentAt: days(-2) }), counterparts)).toMatchObject({ state: "SENT", amountCents: 2400, date: days(-2).toISOString() });
    expect(toPayoutItem(rec({ status: "COMPLETED", payoutStatus: "PENDING" }), counterparts)).toMatchObject({ state: "PENDING" });
    expect(toPayoutItem(rec({ status: "COMPLETED", payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY" }), counterparts)).toMatchObject({ state: "BLOCKED" });
    expect(toPayoutItem(rec({ status: "COMPLETED", payoutStatus: "FAILED", payoutFailureReason: "PROVIDER_ERROR:x" }), counterparts)).toMatchObject({ state: "PENDING" });
    expect(toPayoutItem(rec({ status: "COMPLETED" }), counterparts)).toBeNull();
    expect(toPayoutItem(rec({ status: "COMPLETED", payoutStatus: "REVERSED" }), counterparts)).toMatchObject({ state: "REVERSED" }); // A87
  });

  it("CANCELLED tardif compensé : kind LATE_CANCELLATION, montant = compensation (jamais le net)", () => {
    const item = toPayoutItem(rec({ status: "CANCELLED", retentionDisposition: "CARRIER", payoutStatus: "SENT", payoutAmountCents: 1200, payoutSentAt: days(-1) }), counterparts)!;
    expect(item).toMatchObject({ kind: "LATE_CANCELLATION", state: "SENT", amountCents: 1200 });
  });

  it("rien pour PENDING / ACCEPTED / PICKED_UP / DECLINED / EXPIRED", () => {
    for (const status of ["PENDING", "ACCEPTED", "PICKED_UP", "DECLINED", "EXPIRED"]) {
      expect(toPayoutItem(rec({ status }), counterparts)).toBeNull();
    }
  });
});

describe("Voyageur — buildCarrierWallet", () => {
  it("totaux = somme des lignes par état ; « ce mois » en UTC ; lignes triées par date décroissante ; contrat respecté", () => {
    const wallet = buildCarrierWallet(
      [
        rec({ status: "DELIVERED", payoutDueAt: days(2) }),
        rec({ status: "COMPLETED", payoutStatus: "SENT", payoutSentAt: days(-3), pricing: { transportCents: 1000, totalShipperCents: 1300, currencyCode: "EUR" } }),
        rec({ status: "COMPLETED", payoutStatus: "SENT", payoutSentAt: new Date("2026-06-02T00:00:00.000Z"), pricing: { transportCents: 5000, totalShipperCents: 6000, currencyCode: "EUR" } }),
        rec({ status: "COMPLETED", payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY", pricing: { transportCents: 700, totalShipperCents: 900, currencyCode: "EUR" } }),
        rec({ status: "DISPUTED", payoutStatus: "FROZEN", pricing: { transportCents: 300, totalShipperCents: 400, currencyCode: "EUR" } }),
        rec({ status: "ACCEPTED" }),
      ],
      counterparts,
      NOW
    );
    expect(wallet.upcomingCents).toBe(2400);
    expect(wallet.sentCents).toBe(6000);
    expect(wallet.sentThisMonthCents).toBe(1000);
    expect(wallet.blockedCents).toBe(700);
    expect(wallet.pendingCents).toBe(1000); // 700 bloqués + 300 gelés
    expect(wallet.items).toHaveLength(5);
    expect(wallet.items[0].state).toBe("UPCOMING"); // la date la plus lointaine (J+2) d'abord
    expect(() => CarrierWalletSchema.parse(wallet)).not.toThrow();
  });

  it("vide → zéros, EUR, aucune ligne", () => {
    expect(buildCarrierWallet([], counterparts, NOW)).toEqual({ upcomingCents: 0, pendingCents: 0, blockedCents: 0, sentCents: 0, sentThisMonthCents: 0, currencyCode: "EUR", items: [] });
  });
});

describe("Expéditeur — toPaymentItem / buildShipperWallet", () => {
  it("chaque statut a son état : AUTHORIZED, HELD, RELEASED, RELEASED_NO_CHARGE, REFUNDED, PARTIALLY_REFUNDED", () => {
    expect(toPaymentItem(rec({ status: "PENDING" }), counterparts)).toMatchObject({ state: "AUTHORIZED", amountCents: 2957, counterpartFirstName: "Thomas" });
    expect(toPaymentItem(rec({ status: "PICKED_UP", capturedAt: days(-5) }), counterparts)).toMatchObject({ state: "HELD" });
    expect(toPaymentItem(rec({ status: "DELIVERED", capturedAt: days(-5), payoutDueAt: days(3) }), counterparts)).toMatchObject({ state: "HELD", date: days(3).toISOString() });
    expect(toPaymentItem(rec({ status: "COMPLETED", capturedAt: days(-5), completedAt: days(-1) }), counterparts)).toMatchObject({ state: "RELEASED", date: days(-1).toISOString() });
    expect(toPaymentItem(rec({ status: "DECLINED" }), counterparts)).toMatchObject({ state: "RELEASED_NO_CHARGE" });
    expect(toPaymentItem(rec({ status: "CANCELLED", refundAmountCents: 2957 }), counterparts)).toMatchObject({ state: "RELEASED_NO_CHARGE" }); // annulé en PENDING : jamais capturé
    expect(toPaymentItem(rec({ status: "CANCELLED", capturedAt: days(-5), refundAmountCents: 2957, refundedAt: days(-1) }), counterparts)).toMatchObject({ state: "REFUNDED", refundAmountCents: 2957 });
    expect(toPaymentItem(rec({ status: "CANCELLED", capturedAt: days(-5), refundAmountCents: 1479, refundedAt: days(-1) }), counterparts)).toMatchObject({ state: "PARTIALLY_REFUNDED", refundAmountCents: 1479, retentionCents: 1478 });
  });

  it("totaux : bloqué = HELD ; dépensé = RELEASED + retenues ; remboursé = remboursements réels ; contrat respecté", () => {
    const wallet = buildShipperWallet(
      [
        rec({ status: "PENDING" }),
        rec({ status: "DELIVERED", capturedAt: days(-5), payoutDueAt: days(3) }),
        rec({ status: "COMPLETED", capturedAt: days(-9), completedAt: days(-2), pricing: { transportCents: 800, totalShipperCents: 1000, currencyCode: "EUR" } }),
        rec({ status: "CANCELLED", capturedAt: days(-5), refundAmountCents: 1479, refundedAt: days(-1) }),
        rec({ status: "EXPIRED" }),
      ],
      counterparts
    );
    expect(wallet.heldCents).toBe(2957);
    expect(wallet.spentCents).toBe(1000 + 1478);
    expect(wallet.refundedCents).toBe(1479);
    expect(wallet.items).toHaveLength(5);
    expect(() => ShipperWalletSchema.parse(wallet)).not.toThrow();
  });
});
