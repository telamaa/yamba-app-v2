/**
 * deal-mediation.service.spec.ts — règles PURES de la médiation (C-PR2, D55)
 */
import { assertNotParty, computeResolutionMoney, disputeLoser, disputeResponseDeadline, isDisputeDecidable } from "./deal-mediation.service";

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
  it("ANO-ADM-52 — l'échéance figée à l'ouverture gagne sur le paramètre courant (D62, jamais rétroactif)", () => {
    const responseDueAt = new Date("2026-09-06T10:00:00Z"); // ouvert avec 72 h
    // Le paramètre est ramené à 12 h après l'ouverture : l'échéance annoncée au Voyageur ne bouge pas.
    expect(disputeResponseDeadline(disputedAt, 12, responseDueAt).toISOString()).toBe("2026-09-06T10:00:00.000Z");
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: null, responseDueAt }, new Date("2026-09-04T10:00:00Z"), 12)).toBe(false);
    // Allongé à 168 h : le dossier reste décidable à son échéance d'origine.
    expect(isDisputeDecidable({ disputedAt, carrierRespondedAt: null, responseDueAt }, new Date("2026-09-06T10:00:00Z"), 168)).toBe(true);
    // Dossier antérieur sans échéance figée : repli sur le paramètre courant.
    expect(disputeResponseDeadline(disputedAt, 12, null).toISOString()).toBe("2026-09-03T22:00:00.000Z");
  });
});

describe("disputeLoser (D55 4A)", () => {
  it("rejet → l'Expéditeur ; tout remboursement → le Voyageur", () => {
    expect(disputeLoser("REJECTED")).toBe("SHIPPER");
    expect(disputeLoser("PARTIAL_REFUND")).toBe("CARRIER");
    expect(disputeLoser("FULL_REFUND")).toBe("CARRIER");
  });
});

describe("assertNotParty (C-PR3, D56) — conflit d'intérêts", () => {
  const booking = { shipperId: "s1", carrierId: "c1" };
  it("un admin partie au deal ne tranche pas (403)", () => {
    expect(() => assertNotParty({ id: "s1" }, booking)).toThrow(/party to this deal/);
    expect(() => assertNotParty({ id: "c1" }, booking)).toThrow(/party to this deal/);
  });
  it("un tiers passe", () => {
    expect(() => assertNotParty({ id: "admin" }, booking)).not.toThrow();
  });
});
