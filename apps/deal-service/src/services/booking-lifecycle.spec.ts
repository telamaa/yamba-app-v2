/**
 * booking-lifecycle.spec.ts — barème ANN-01 (D39) et helpers purs
 * ===============================================================
 * Bornes EXACTES du barème : 100 % jusqu'à J-2 (≥ 48 h avant départ),
 * retenue 50 % en deçà — y compris l'arrondi banquier sur montant impair.
 */
import {
  CANCEL_FULL_REFUND_UNTIL_HOURS,
  CANCEL_LATE_RETENTION_PCT,
  computeCancellationRefundCents,
  kgReservedBySnapshot,
} from "./booking-lifecycle";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("computeCancellationRefundCents — barème ANN-01 (D39)", () => {
  it("paramètres gravés D39 : 48 h / 50 %", () => {
    expect(CANCEL_FULL_REFUND_UNTIL_HOURS).toBe(48);
    expect(CANCEL_LATE_RETENTION_PCT).toBe(50);
  });

  it("départ dans plus de 48 h → remboursement intégral", () => {
    expect(
      computeCancellationRefundCents({ totalShipperCents: 2957, departureAt: hoursFromNow(72), now: NOW })
    ).toBe(2957);
  });

  it("borne EXACTE : départ dans exactement 48 h → encore 100 %", () => {
    expect(
      computeCancellationRefundCents({ totalShipperCents: 2957, departureAt: hoursFromNow(48), now: NOW })
    ).toBe(2957);
  });

  it("une minute sous la borne → retenue 50 %, arrondi au cent le plus proche", () => {
    // 2957 × 50 % = 1478,5 → 1479 (Math.round)
    expect(
      computeCancellationRefundCents({
        totalShipperCents: 2957,
        departureAt: new Date(hoursFromNow(48).getTime() - 60_000),
        now: NOW,
      })
    ).toBe(1479);
  });

  it("montant pair : retenue exacte sans arrondi", () => {
    expect(
      computeCancellationRefundCents({ totalShipperCents: 3000, departureAt: hoursFromNow(2), now: NOW })
    ).toBe(1500);
  });

  it("départ déjà passé (pickup jamais confirmé) → même barème « moins de 48 h »", () => {
    expect(
      computeCancellationRefundCents({ totalShipperCents: 3000, departureAt: hoursFromNow(-5), now: NOW })
    ).toBe(1500);
  });
});

describe("kgReservedBySnapshot — miroir CAP-02 de kgToReserve", () => {
  it("restitue le poids du snapshot pricing (PARCEL : déclaré ; FLAT_BAG : franchise)", () => {
    expect(kgReservedBySnapshot({ weightKg: 2 })).toBe(2);
    expect(kgReservedBySnapshot({ weightKg: 23 })).toBe(23);
  });
});
