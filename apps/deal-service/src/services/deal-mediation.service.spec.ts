/**
 * deal-mediation.service.spec.ts — règles PURES de la médiation (C-PR2, D55)
 */
import { computeResolutionMoney, disputeLoser, disputeResponseDeadline, isDisputeDecidable } from "./deal-mediation.service";

const pricing = { totalShipperCents: 5100, transportCents: 4500 }; // commission 600

describe("computeResolutionMoney (D54 3A)", () => {
  it("REJECTED : rien remboursé, net entier au Voyageur, commission conservée", () => {
    expect(computeResolutionMoney("REJECTED", undefined, pricing)).toEqual({ refundCents: 0, carrierPayoutCents: 4500, yambaKeepsCents: 600 });
  });
  it("FULL_REFUND : tout remboursé, commission comprise, Voyageur 0", () => {
    expect(computeResolutionMoney("FULL_REFUND", undefined, pricing)).toEqual({ refundCents: 5100, carrierPayoutCents: 0, yambaKeepsCents: 0 });
  });
  it("PARTIAL_REFUND : Voyageur = net − X, Yamba garde le reste", () => {
    expect(computeResolutionMoney("PARTIAL_REFUND", 2000, pricing)).toEqual({ refundCents: 2000, carrierPayoutCents: 2500, yambaKeepsCents: 600 });
  });
  it("PARTIAL_REFUND au-delà du net : Voyageur plancher 0, Yamba absorbe", () => {
    expect(computeResolutionMoney("PARTIAL_REFUND", 4800, pricing)).toEqual({ refundCents: 4800, carrierPayoutCents: 0, yambaKeepsCents: 300 });
  });
  it("PARTIAL_REFUND hors bornes (0, total, non entier, absent) → ValidationError", () => {
    for (const bad of [0, 5100, 5200, 12.5, undefined]) {
      expect(() => computeResolutionMoney("PARTIAL_REFUND", bad as number | undefined, pricing)).toThrow(/between 1 cent/);
    }
    expect(computeResolutionMoney("PARTIAL_REFUND", 5099, pricing).carrierPayoutCents).toBe(0);
    expect(computeResolutionMoney("PARTIAL_REFUND", 1, pricing).carrierPayoutCents).toBe(4499);
  });
  it("les trois flux se somment toujours au total payé", () => {
    for (const x of [1, 600, 2000, 4500, 4501, 5099]) {
      const m = computeResolutionMoney("PARTIAL_REFUND", x, pricing);
      expect(m.refundCents + m.carrierPayoutCents + m.yambaKeepsCents).toBe(5100);
    }
  });
});

describe("délai de réponse du Voyageur (D55 1A, 72 h)", () => {
  const disputedAt = new Date("2026-09-03T10:00:00Z");
  it("échéance = ouverture + 72 h", () => {
    expect(disputeResponseDeadline(disputedAt).toISOString()).toBe("2026-09-06T10:00:00.000Z");
  });
  it("décidable dès la réponse, sinon à l'échéance (borne incluse)", () => {
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: null }, new Date("2026-09-04T10:00:00Z"))).toBe(false);
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: new Date("2026-09-03T12:00:00Z") }, new Date("2026-09-03T12:01:00Z"))).toBe(true);
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: null }, new Date("2026-09-06T09:59:59Z"))).toBe(false);
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: null }, new Date("2026-09-06T10:00:00Z"))).toBe(true);
  });
});

describe("disputeLoser (D55 4A)", () => {
  it("rejet → l'Expéditeur ; tout remboursement → le Voyageur", () => {
    expect(disputeLoser("REJECTED")).toBe("SHIPPER");
    expect(disputeLoser("PARTIAL_REFUND")).toBe("CARRIER");
    expect(disputeLoser("FULL_REFUND")).toBe("CARRIER");
  });
});
