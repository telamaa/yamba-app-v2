import { containsText, equalsText, escapeRegex } from "@packages/libs/prisma/text-search";
import { getTripAdminEmails } from "../emails/admin-trip-emails";

/**
 * ANO-ADM-15 (recette 02-ADMIN § 5.7) — `packages/libs/prisma/text-search.ts`, partagé par trip-service et auth-service.
 * La preuve en base (« ( » → 500, « . » → tout) est dans la fiche e2e ; ici, le contrat de la fonction.
 */
describe("text-search — un terme saisi n'est jamais une regex", () => {
  it("escapeRegex échappe chaque métacaractère, et un terme échappé se relit à la lettre", () => {
    const brut = "a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o";
    const echappe = escapeRegex(brut);
    expect(new RegExp(`^${echappe}$`).test(brut)).toBe(true);
    expect(new RegExp(echappe).test("aXb")).toBe(false);
    expect(() => new RegExp(escapeRegex("("))).not.toThrow();
    expect(escapeRegex("Brazzaville")).toBe("Brazzaville");
  });
  it("containsText / equalsText : insensibles à la casse, valeur échappée", () => {
    expect(containsText("P.ris")).toEqual({ contains: "P\\.ris", mode: "insensitive" });
    expect(equalsText("(Kin)")).toEqual({ equals: "\\(Kin\\)", mode: "insensitive" });
  });
  it("un motif à retour arrière catastrophique devient un texte inerte", () => {
    const echappe = escapeRegex("(a+)+$");
    const debut = Date.now();
    expect(new RegExp(echappe).test("a".repeat(40) + "!")).toBe(false);
    expect(Date.now() - debut).toBeLessThan(50);
  });
});

describe("ANO-ADM-18 — l'email « trajet masqué » mène à son trajet", () => {
  it.each(["fr", "en"] as const)("%s : bouton vers le trajet, jamais le motif interne", (locale) => {
    const mail = getTripAdminEmails(locale).tripHidden({ firstName: "Thomas", route: "Paris → Brazzaville", tripUrl: "http://localhost:3000/fr/trips/abc", supportEmail: "support@yamba.app" });
    expect(mail.content.cta?.url).toBe("http://localhost:3000/fr/trips/abc");
    expect(JSON.stringify(mail)).not.toMatch(/photos empruntées|motif interne/);
  });
});
