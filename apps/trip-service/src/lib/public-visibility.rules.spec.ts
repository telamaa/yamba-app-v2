import { publicTripWhere } from "./public-visibility.rules";

/**
 * ANO-API-02 (recette API 08/09/2026, fiche API-GW-18) — la visibilité d'un trajet
 * public doit vivre DANS la requête, sinon un trajet masqué se distingue d'un trajet
 * inexistant par le temps de réponse.
 */
describe("publicTripWhere — un trajet invisible est introuvable, pas jeté après coup", () => {
  it("exige publié, non supprimé et non masqué", () => {
    const w = publicTripWhere("665f1c2ab3d4e5f6a7b8c9d0");
    expect(w.id).toBe("665f1c2ab3d4e5f6a7b8c9d0");
    expect(w.status).toBe("PUBLISHED");
    expect(w.isDeleted).toEqual({ not: true });
  });

  it("le masquage couvre le champ ABSENT autant que null (piège Prisma + Mongo)", () => {
    const w = publicTripWhere("665f1c2ab3d4e5f6a7b8c9d0");
    expect(w.AND[0]).toEqual({
      OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }],
    });
  });

  it("n'utilise jamais `isDeleted: false`, qui raterait les documents sans le champ", () => {
    expect(JSON.stringify(publicTripWhere("665f1c2ab3d4e5f6a7b8c9d0"))).not.toContain('"isDeleted":false');
  });
});
