import { placeSearchTerm } from "./place-text";

describe("placeSearchTerm — le texte d'un lieu tel que la recherche le comprend (WEB-ACC-9)", () => {
  it("garde la ville seule d'un libellé « Ville, Pays » de l'autocomplétion", () => {
    expect(placeSearchTerm("Brazzaville, République du Congo")).toBe("Brazzaville");
    expect(placeSearchTerm("Amsterdam, Pays-Bas")).toBe("Amsterdam");
    expect(placeSearchTerm("Brazzaville, Republic of the Congo")).toBe("Brazzaville");
  });

  it("rend tel quel un texte sans virgule (ville du pays d'origine, ou pays tapé à la main)", () => {
    expect(placeSearchTerm("Paris")).toBe("Paris");
    expect(placeSearchTerm("Congo")).toBe("Congo");
  });

  it("nettoie les espaces et ne rend jamais une chaîne vide", () => {
    expect(placeSearchTerm("  Paris , France ")).toBe("Paris");
    expect(placeSearchTerm("")).toBeNull();
    expect(placeSearchTerm("   ")).toBeNull();
    expect(placeSearchTerm(", France")).toBeNull();
    expect(placeSearchTerm(null)).toBeNull();
    expect(placeSearchTerm(undefined)).toBeNull();
  });
});
