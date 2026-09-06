/** profile.rules.spec.ts — D67 : une erreur par champ, une date de naissance plausible, une URL ImageKit vérifiée. */
import { isImageKitUrl, normalizeProfileUpdate, validateBirthDate } from "./profile.rules";

const now = new Date("2026-09-05T12:00:00.000Z");

describe("validateBirthDate", () => {
  it("passée et 16 ans au moins → ok ; futur, trop jeune, invalide, trop vieux → code", () => {
    expect(validateBirthDate("1990-05-20", now)).toBeNull();
    expect(validateBirthDate("2010-09-05", now)).toBeNull(); // 16 ans jour pour jour
    expect(validateBirthDate("2010-09-06", now)).toBe("TOO_YOUNG");
    expect(validateBirthDate("2027-01-01", now)).toBe("IN_THE_FUTURE");
    expect(validateBirthDate("2026-02-30", now)).toBe("INVALID_DATE");
    expect(validateBirthDate("1890-01-01", now)).toBe("INVALID_DATE");
  });
});

describe("normalizeProfileUpdate", () => {
  it("sépare User et CarrierPage, nettoie les noms, refuse la présentation sans page Voyageur", () => {
    const r = normalizeProfileUpdate({ firstName: "  Awa   Marie ", lastName: "Diop", displayName: "Awa D.", bio: "  Je voyage souvent.  ", birthDate: "1990-05-20", profilePublic: false, showCity: true }, { hasCarrierPage: true, now });
    expect(r.errors).toEqual({});
    expect(r.user).toMatchObject({ firstName: "Awa Marie", lastName: "Diop", profilePublic: false, showCity: true });
    expect((r.user.birthDate as Date).toISOString()).toBe("1990-05-20T00:00:00.000Z");
    expect(r.carrier).toEqual({ name: "Awa D.", bio: "Je voyage souvent." });
    const noPage = normalizeProfileUpdate({ displayName: "X", bio: "y" }, { hasCarrierPage: false, now });
    expect(noPage.errors).toEqual({ displayName: "NO_CARRIER_PAGE", bio: "NO_CARRIER_PAGE" });
    expect(noPage.carrier).toEqual({});
  });
  it("bio vide → null ; date null → effacée ; date trop jeune → erreur sans écriture", () => {
    expect(normalizeProfileUpdate({ bio: "   " }, { hasCarrierPage: true, now }).carrier).toEqual({ bio: null });
    expect(normalizeProfileUpdate({ birthDate: null }, { hasCarrierPage: false, now }).user).toEqual({ birthDate: null });
    const r = normalizeProfileUpdate({ birthDate: "2020-01-01" }, { hasCarrierPage: false, now });
    expect(r.errors.birthDate).toBe("TOO_YOUNG");
    expect(r.user).toEqual({});
  });
});

describe("isImageKitUrl (D42)", () => {
  it("n'accepte que notre endpoint, sans remontée de chemin", () => {
    expect(isImageKitUrl("https://ik.imagekit.io/yamba/avatars/a.jpg", "https://ik.imagekit.io/yamba")).toBe(true);
    expect(isImageKitUrl("https://ik.imagekit.io/yamba/avatars/a.jpg", "https://ik.imagekit.io/yamba/")).toBe(true);
    expect(isImageKitUrl("https://ik.imagekit.io/other/a.jpg", "https://ik.imagekit.io/yamba")).toBe(false);
    expect(isImageKitUrl("https://evil.example/x.jpg", "https://ik.imagekit.io/yamba")).toBe(false);
    expect(isImageKitUrl("https://ik.imagekit.io/yamba/../x.jpg", "https://ik.imagekit.io/yamba")).toBe(false);
    expect(isImageKitUrl("https://ik.imagekit.io/yamba/a.jpg", undefined)).toBe(false);
  });
});
