import { LIBELLE_MEMBRE_SUPPRIME, nomDeLaContrepartie } from "./counterpart-label";

describe("nomDeLaContrepartie (D63 — ANO-WEB-83)", () => {
  it("un membre vivant garde son prénom", () => {
    expect(nomDeLaContrepartie({ firstName: "Thomas", isDeleted: false })).toBe("Thomas");
  });

  it("un compte effacé s'affiche « Membre supprimé », jamais le prénom anonymisé seul", () => {
    // L'effacement écrit firstName = "Membre" / lastName = "supprimé" : rendu tel quel, « Membre » se lit comme un prénom.
    expect(nomDeLaContrepartie({ firstName: "Membre", isDeleted: true })).toBe(LIBELLE_MEMBRE_SUPPRIME);
  });

  it("une contrepartie introuvable donne un tiret, jamais une chaîne vide", () => {
    expect(nomDeLaContrepartie(null)).toBe("—");
    expect(nomDeLaContrepartie({ firstName: null, isDeleted: false })).toBe("—");
  });
});
