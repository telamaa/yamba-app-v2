import { canReceiveEmail, reachableRecipientWhere, suppressionReasonLabel } from "@packages/email";

describe("canReceiveEmail — la règle unique du destinataire joignable (D35 4A, ANO-ADM-10 / 11)", () => {
  it("un compte actif avec une adresse : oui", () => {
    expect(canReceiveEmail({ email: "a@b.test", isDeleted: false, emailSuppressedAt: null })).toBe(true);
    expect(canReceiveEmail({ email: "a@b.test" })).toBe(true); // champs absents (documents anciens)
  });

  it("adresse sur la liste de suppression, compte effacé, adresse vide : non", () => {
    expect(canReceiveEmail({ email: "a@b.test", emailSuppressedAt: new Date() })).toBe(false);
    expect(canReceiveEmail({ email: "a@b.test", emailSuppressedAt: "2026-09-14T08:00:00.000Z" })).toBe(false);
    expect(canReceiveEmail({ email: "a@b.test", isDeleted: true })).toBe(false);
    expect(canReceiveEmail({ email: "  " })).toBe(false);
    expect(canReceiveEmail(null)).toBe(false);
  });

  it("le fragment Prisma voit aussi le champ ABSENT (piège Mongo)", () => {
    expect(reachableRecipientWhere()).toEqual({ isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] });
  });

  it("libellé du motif : un motif inconnu n'est plus présenté comme un rebond dur", () => {
    expect(suppressionReasonLabel("HARD_BOUNCE")).toBe("rebond dur");
    expect(suppressionReasonLabel("COMPLAINT")).toBe("plainte");
    expect(suppressionReasonLabel("UNKNOWN")).toBe("motif non renseigné");
    expect(suppressionReasonLabel(null)).toBe("motif non renseigné");
  });
});
