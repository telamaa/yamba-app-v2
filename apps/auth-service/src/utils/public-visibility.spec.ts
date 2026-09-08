import { publicProfileWhere } from "./public-visibility";

/**
 * ANO-API-02 (recette API 08/09/2026, fiche API-GW-18) — pendant auth-service :
 * un profil privé ne doit pas se distinguer d'un slug inexistant, ni par le corps
 * ni par le temps de réponse.
 */
describe("publicProfileWhere — la visibilité vit dans la requête", () => {
  it("visiteur anonyme : seulement les profils publics et non supprimés", () => {
    const w = publicProfileWhere("loulou-b-0dddv", null);
    expect(w.publicSlug).toBe("loulou-b-0dddv");
    expect(w.isDeleted).toEqual({ not: true });
    expect(w.OR).toEqual([{ profilePublic: { not: false } }]);
  });

  it("propriétaire connecté : son propre profil reste chargeable même masqué (D67 1A)", () => {
    const w = publicProfileWhere("loulou-b-0dddv", "665f1c2ab3d4e5f6a7b8c9d0");
    expect(w.OR).toEqual([{ profilePublic: { not: false } }, { id: "665f1c2ab3d4e5f6a7b8c9d0" }]);
  });

  it("un autre membre connecté n'obtient AUCUN passe-droit sur un profil masqué", () => {
    const w = publicProfileWhere("loulou-b-0dddv", "111111111111111111111111");
    expect(w.OR).toContainEqual({ id: "111111111111111111111111" });
    // le seul élargissement possible est l'identité de l'appelant, jamais le slug visé
    expect(w.OR).toHaveLength(2);
  });

  it("n'utilise ni `profilePublic: true` ni `isDeleted: false` (documents sans le champ)", () => {
    const s = JSON.stringify(publicProfileWhere("x", null));
    expect(s).not.toContain('"profilePublic":true');
    expect(s).not.toContain('"isDeleted":false');
  });
});
