import { detectContactInfo, normalizeBody, sixDigitCandidates } from "./message-guard.rules";

describe("message-guard.rules (chantier F, D61 4A / 5A)", () => {
  it("groupes de six chiffres isolés seulement, trois au plus (le code de livraison, D43)", () => {
    expect(sixDigitCandidates("le code est 742891 comme convenu")).toEqual(["742891"]);
    expect(sixDigitCandidates("vol AF123 le 04/09/2026 porte 75001")).toEqual([]);
    expect(sixDigitCandidates("+33612345678")).toEqual([]);
    expect(sixDigitCandidates("111111 222222 333333 444444")).toHaveLength(3);
    expect(sixDigitCandidates("742891 et encore 742891")).toEqual(["742891"]);
  });
  it("coordonnées : email et téléphone détectés, jamais bloquants", () => {
    expect(detectContactInfo("ecris-moi a a.b@mail.com")).toMatchObject({ hasEmail: true, flagged: true });
    expect(detectContactInfo("mon numero 06 12 34 56 78")).toMatchObject({ hasPhone: true, flagged: true });
    expect(detectContactInfo("appelle le +33612345678")).toMatchObject({ hasPhone: true, flagged: true });
    expect(detectContactInfo("rendez-vous terminal 2F a 14h")).toEqual({ hasEmail: false, hasPhone: false, flagged: false });
    expect(detectContactInfo("le colis fait 12 kg pour 45 euros")).toMatchObject({ flagged: false });
  });
  it("normalizeBody : espaces multiples réduits, lignes vides bornées, bords coupés", () => {
    expect(normalizeBody("  bonjour   toi  ")).toBe("bonjour toi");
    expect(normalizeBody("a\n\n\n\n\nb")).toBe("a\n\nb");
    expect(normalizeBody("texte normal")).toBe("texte normal");
  });
});
