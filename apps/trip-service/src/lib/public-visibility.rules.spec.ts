import { publicTripWhere } from "./public-visibility.rules";

/**
 * ANO-API-02 (fiche API-GW-18) — la visibilité d'un trajet public doit vivre DANS la requête,
 * sinon un trajet masqué se distingue d'un trajet inexistant par le temps de réponse.
 *
 * ANO-API-23 (08/09/2026) — la première version de ce spec exigeait l'inverse de ce qu'il fallait :
 * « n'utilise jamais `isDeleted: false`, qui raterait les documents sans le champ ». Deux erreurs
 * dans une phrase. D'abord `{ not: true }` ne matche pas davantage un champ absent — d'où 404 sur
 * **24 trajets publiés sur 37**. Ensuite le remède habituel du projet, `isSet: false`, n'est pas
 * disponible sur un champ REQUIS : Prisma ne l'offre que sur les champs optionnels (c'est pourquoi
 * `hiddenByAdminAt`, qui est `DateTime?`, y a droit).
 *
 * Un champ requis absent est donc un défaut de DONNÉES, corrigé par
 * `repair-absent-scalars.ts` — pas un filtre à contourner.
 */
describe("publicTripWhere — un trajet invisible est introuvable, pas jeté après coup", () => {
  const ID = "665f1c2ab3d4e5f6a7b8c9d0";

  it("exige publié, non supprimé et non masqué", () => {
    const w = publicTripWhere(ID);
    expect(w.id).toBe(ID);
    expect(w.status).toBe("PUBLISHED");
    expect(w.isDeleted).toBe(false);
  });

  it("le masquage couvre le champ ABSENT autant que null — il est optionnel, donc `isSet` marche", () => {
    expect(publicTripWhere(ID).AND[0]).toEqual({
      OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }],
    });
  });

  it("`isDeleted` s'écrit en égalité simple : `not` ne servirait à rien et `isSet` est refusé", () => {
    const s = JSON.stringify(publicTripWhere(ID));
    expect(s).toContain('"isDeleted":false');
    expect(s).not.toContain('"isDeleted":{');
  });
});
