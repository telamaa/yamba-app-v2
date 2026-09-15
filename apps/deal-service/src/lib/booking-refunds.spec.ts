/**
 * booking-refunds.spec.ts — la liste des remboursements d'un deal (recette 02-ADMIN § 5.16, ANO-ADM-37, A166)
 */
import { refundEntries, refundedTotalCents, refundListExcessCents, withRefund } from "./booking-refunds";

const d = (s: string) => new Date(s);

describe("withRefund (A166)", () => {
  const CAPTURE = d("2026-03-01T00:00:00Z");
  it("premier remboursement : une liste d'une entrée, que la liste soit absente ou vide", () => {
    const e = { refundId: "re_1", amountCents: 1950, refundedAt: d("2026-03-10T00:00:00Z"), kind: "CANCELLATION" as const };
    expect(withRefund({ capturedAt: CAPTURE }, e)).toEqual([e]);
    expect(withRefund({ capturedAt: CAPTURE, refunds: [] }, e)).toEqual([e]);
  });
  it("ajoute sans muter l'existant", () => {
    const existing = [{ refundId: "re_1", amountCents: 1950, refundedAt: d("2026-03-10T00:00:00Z"), kind: "CANCELLATION" }];
    const next = withRefund({ capturedAt: CAPTURE, refundAmountCents: 1950, refundedAt: d("2026-03-10T00:00:00Z"), refunds: existing }, { refundId: "re_2", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" });
    expect(next.map((r) => r.refundId)).toEqual(["re_1", "re_2"]);
    expect(existing).toHaveLength(1);
  });
  it("document antérieur (cumul sans liste) : l'ancien remboursement est matérialisé À SA DATE avant d'être écrasé", () => {
    const next = withRefund(
      { capturedAt: CAPTURE, refundAmountCents: 1000, refundedAt: d("2026-03-10T00:00:00Z"), refundId: "re_old" },
      { refundId: "re_new", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" },
    );
    expect(next).toEqual([
      { refundId: "re_old", amountCents: 1000, refundedAt: d("2026-03-10T00:00:00Z"), kind: "LEGACY" },
      { refundId: "re_new", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" },
    ]);
  });
});

describe("refundEntries (A166)", () => {
  it("ANO-ADM-37 : deux remboursements, deux dates — le premier garde son mois et son identifiant", () => {
    const b = {
      capturedAt: d("2026-03-01T00:00:00Z"),
      refundAmountCents: 2450,
      refundedAt: d("2026-04-02T00:00:00Z"),
      refundId: "re_2",
      refunds: [
        { refundId: "re_1", amountCents: 1950, refundedAt: d("2026-03-10T00:00:00Z"), kind: "CANCELLATION" },
        { refundId: "re_2", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" },
      ],
    };
    expect(refundEntries(b).map((r) => [r.refundId, r.amountCents, r.refundedAt.toISOString().slice(0, 7)])).toEqual([["re_1", 1950, "2026-03"], ["re_2", 500, "2026-04"]]);
    expect(refundedTotalCents(b)).toBe(2450);
  });

  it("une annulation AVANT capture n'est pas un remboursement, même avec un cumul posé", () => {
    expect(refundEntries({ capturedAt: null, refundAmountCents: 2957, refundedAt: d("2026-03-10T00:00:00Z"), refunds: [] })).toEqual([]);
    expect(refundedTotalCents({ refundAmountCents: 2957, refundedAt: d("2026-03-10T00:00:00Z") })).toBe(0);
  });

  it("document antérieur (liste absente) : une entrée LEGACY datée du dernier remboursement", () => {
    expect(refundEntries({ capturedAt: d("2026-03-01T00:00:00Z"), refundAmountCents: 1479, refundedAt: d("2026-03-10T00:00:00Z"), refundId: "re_old" })).toEqual([
      { refundId: "re_old", amountCents: 1479, refundedAt: d("2026-03-10T00:00:00Z"), kind: "LEGACY" },
    ]);
  });

  it("liste partielle (remboursement antérieur puis un nouveau) : la part inexpliquée devient LEGACY, sans identifiant usurpé", () => {
    const entries = refundEntries({
      capturedAt: d("2026-03-01T00:00:00Z"),
      refundAmountCents: 1500,
      refundedAt: d("2026-04-02T00:00:00Z"),
      refundId: "re_new",
      refunds: [{ refundId: "re_new", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" }],
    });
    expect(entries).toEqual([
      { refundId: "re_new", amountCents: 500, refundedAt: d("2026-04-02T00:00:00Z"), kind: "MANUAL" },
      { refundId: null, amountCents: 1000, refundedAt: d("2026-04-02T00:00:00Z"), kind: "LEGACY" },
    ]);
  });

  it("cumul sans date (document incomplet) : le montant compte quand même, daté de la capture", () => {
    expect(refundedTotalCents({ capturedAt: d("2026-03-01T00:00:00Z"), refundAmountCents: 700 })).toBe(700);
  });

  it("aucun remboursement : liste vide", () => {
    expect(refundEntries({ capturedAt: d("2026-03-01T00:00:00Z"), refundAmountCents: null, refunds: [] })).toEqual([]);
  });
});

describe("refundListExcessCents — invariant Σ liste = cumul (recette § 5.16)", () => {
  const CAPTURE = d("2026-03-01T00:00:00Z");
  const e = (amountCents: number) => ({ refundId: null, amountCents, refundedAt: d("2026-03-10T00:00:00Z"), kind: "CANCELLATION" });
  it("cohérent : liste = cumul, ou liste plus courte (document antérieur, part LEGACY)", () => {
    expect(refundListExcessCents({ capturedAt: CAPTURE, refundAmountCents: 1500, refunds: [e(1000), e(500)] })).toBe(0);
    expect(refundListExcessCents({ capturedAt: CAPTURE, refundAmountCents: 1500, refunds: [e(500)] })).toBe(0);
    expect(refundListExcessCents({ capturedAt: CAPTURE, refundAmountCents: null, refunds: [] })).toBe(0);
    expect(refundListExcessCents({ capturedAt: null, refundAmountCents: 2957, refunds: [] })).toBe(0); // empreinte libérée
  });
  it("incohérent : la liste enregistre plus que le cumul, ou des remboursements sur un deal jamais capturé", () => {
    expect(refundListExcessCents({ capturedAt: CAPTURE, refundAmountCents: null, refunds: [e(1960)] })).toBe(1960);
    expect(refundListExcessCents({ capturedAt: CAPTURE, refundAmountCents: 1000, refunds: [e(1000), e(500)] })).toBe(500);
    expect(refundListExcessCents({ capturedAt: null, refundAmountCents: null, refunds: [e(700)] })).toBe(700);
  });
});
