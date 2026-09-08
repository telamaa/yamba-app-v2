import { publicProfileWhere } from "./public-visibility";

/**
 * ANO-API-02 (fiche API-GW-18) — pendant auth-service : un profil privé ne doit pas se distinguer
 * d'un slug inexistant, ni par le corps ni par le temps de réponse.
 *
 * ANO-API-23 (08/09/2026) — la première version de ce spec exigeait l'inverse de ce qu'il fallait :
 * « n'utilise ni `profilePublic: true` ni `isDeleted: false` (documents sans le champ) ». Or
 * `{ not: … }` ne matche pas davantage un champ absent — `GET /users/{slug}/public` répondait 404
 * pour **22 comptes sur 26** — et `isSet: false`, le remède habituel, est REFUSÉ par Prisma sur un
 * champ requis. Un champ requis absent est un défaut de DONNÉES
 * (`repair-absent-scalars.ts`), pas un filtre à contourner.
 */
describe("publicProfileWhere — la visibilité vit dans la requête", () => {
  const SLUG = "loulou-b-0dddv";
  const MOI = "665f1c2ab3d4e5f6a7b8c9d0";

  it("visiteur anonyme : seulement les profils publics et non supprimés", () => {
    const w = publicProfileWhere(SLUG, null);
    expect(w.publicSlug).toBe(SLUG);
    expect(w.isDeleted).toBe(false);
    expect(w.OR).toEqual([{ profilePublic: true }]);
  });

  it("propriétaire connecté : son propre profil reste chargeable même masqué (D67 1A)", () => {
    expect(publicProfileWhere(SLUG, MOI).OR).toEqual([{ profilePublic: true }, { id: MOI }]);
  });

  it("un autre membre connecté n'obtient AUCUN passe-droit sur un profil masqué", () => {
    const w = publicProfileWhere(SLUG, "111111111111111111111111");
    expect(w.OR).toContainEqual({ id: "111111111111111111111111" });
    // Le seul élargissement possible est l'identité de l'appelant, jamais le slug visé.
    expect(w.OR).toHaveLength(2);
  });

  it("les deux champs requis s'écrivent en égalité simple, jamais avec `not` ni `isSet`", () => {
    const s = JSON.stringify(publicProfileWhere(SLUG, null));
    expect(s).not.toContain('"not"');
    expect(s).not.toContain('"isSet"');
  });
});
