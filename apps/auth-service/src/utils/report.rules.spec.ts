/** report.rules.spec.ts — règles pures du signalement (D68). */
import { canReport, needsPriorityReview } from "./report.rules";

describe("canReport (D68 1A)", () => {
  const base = { reporterId: "u1", targetType: "TRIP" as const, targetOwnerId: "u2", reason: "SCAM" as const, alreadyOpen: false };
  it("un autre membre, motif de la liste, pas de doublon → autorisé", () => {
    expect(canReport(base)).toEqual({ allowed: true, reason: null });
  });
  it("sa propre cible → OWN_TARGET", () => {
    expect(canReport({ ...base, targetOwnerId: "u1" })).toEqual({ allowed: false, reason: "OWN_TARGET" });
  });
  it("motif hors liste de la cible → REASON_NOT_ALLOWED (usurpation ne vaut pas pour un trajet, contenu illicite pas pour un membre)", () => {
    expect(canReport({ ...base, reason: "IMPERSONATION" })).toEqual({ allowed: false, reason: "REASON_NOT_ALLOWED" });
    expect(canReport({ ...base, targetType: "USER", reason: "ILLEGAL_CONTENT" })).toEqual({ allowed: false, reason: "REASON_NOT_ALLOWED" });
    expect(canReport({ ...base, targetType: "USER", reason: "IMPERSONATION" }).allowed).toBe(true);
  });
  it("doublon ouvert du même auteur → ALREADY_REPORTED", () => {
    expect(canReport({ ...base, alreadyOpen: true })).toEqual({ allowed: false, reason: "ALREADY_REPORTED" });
  });
});

describe("needsPriorityReview (SIG-03)", () => {
  it("prioritaire à partir de 3 signalements ouverts, seuil injectable", () => {
    expect(needsPriorityReview(2)).toBe(false);
    expect(needsPriorityReview(3)).toBe(true);
    expect(needsPriorityReview(2, 2)).toBe(true);
  });
});
