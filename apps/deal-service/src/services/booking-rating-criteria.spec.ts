import { z } from "zod";
import { SubmitRatingRequestSchema } from "@packages/api-contracts";

/**
 * ANO-API-14 (recette API 08/09/2026, fiche API-DEAL-20) — la notation par critères était
 * IMPOSSIBLE. `z.record(enum, valeur)` est devenu EXHAUSTIF en Zod 4 : toutes les clés de
 * l'énumération sont requises. Un Expéditeur qui notait un Voyageur avec ses trois critères
 * (PUNCTUALITY, COMMUNICATION, PARCEL_CARE) recevait un 400 réclamant DECLARATION_CLARITY et
 * RESPONSIVENESS — les critères de l'AUTRE rôle.
 *
 * Le piège est silencieux : le typecheck passe, et les tests qui n'envoient pas de critères
 * passent aussi (le champ est facultatif). Seule la recette l'a vu.
 */
describe("SubmitRatingRequest — les critères sont partiels, par rôle (ANO-API-14)", () => {
  const ok = (criteria: Record<string, string>) =>
    SubmitRatingRequestSchema.safeParse({ rating: 5, criteria }).success;

  it("accepte les trois critères d'un VOYAGEUR noté", () => {
    expect(ok({ PUNCTUALITY: "UP", COMMUNICATION: "UP", PARCEL_CARE: "UP" })).toBe(true);
  });

  it("accepte les critères d'un EXPÉDITEUR noté", () => {
    expect(ok({ DECLARATION_CLARITY: "UP", RESPONSIVENESS: "DOWN", PUNCTUALITY: "UP" })).toBe(true);
  });

  it("accepte un seul critère, et aucun", () => {
    expect(ok({ PUNCTUALITY: "UP" })).toBe(true);
    expect(SubmitRatingRequestSchema.safeParse({ rating: 5 }).success).toBe(true);
  });

  it("refuse toujours un critère inconnu ou un vote invalide", () => {
    expect(ok({ INVENTE: "UP" })).toBe(false);
    expect(ok({ PUNCTUALITY: "PEUT-ÊTRE" })).toBe(false);
  });

  it("le piège de fond : `z.record` sur un enum EXIGE toutes les clés, `z.partialRecord` non", () => {
    const exhaustif = z.record(z.enum(["A", "B"]), z.string());
    const partiel = z.partialRecord(z.enum(["A", "B"]), z.string());
    expect(exhaustif.safeParse({ A: "x" }).success).toBe(false);
    expect(partiel.safeParse({ A: "x" }).success).toBe(true);
  });
});
