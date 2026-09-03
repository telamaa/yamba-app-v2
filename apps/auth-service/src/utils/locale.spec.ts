import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveLocale,
} from "@packages/api-contracts";

describe("locale (D44) — une liste unique, une résolution tolérante", () => {
  it("la liste supportée contient fr et en, fr par défaut", () => {
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en"]);
    expect(DEFAULT_LOCALE).toBe("fr");
  });

  it.each([
    ["fr", "fr"],
    ["FR", "fr"],
    ["fr-FR", "fr"],
    ["en_US", "en"],
    ["en-US,en;q=0.9,fr;q=0.8", "en"],
    ["de-DE,de;q=0.9", "fr"],
    ["", "fr"],
    [null, "fr"],
    [undefined, "fr"],
    ["  en  ", "en"],
  ])("resolveLocale(%p) → %s", (raw, expected) => {
    expect(resolveLocale(raw as string | null | undefined)).toBe(expected);
  });

  it("isSupportedLocale est un garde de type strict (pas de normalisation)", () => {
    expect(isSupportedLocale("fr")).toBe(true);
    expect(isSupportedLocale("fr-FR")).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});
