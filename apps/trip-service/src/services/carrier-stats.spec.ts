import { clampedCarrierStats, getCarrierStatDeltas } from "./trip-state-machine";

/**
 * ANO-CRON-01 (recette n° 4, fiche CRON-TRAJETS-1) — le compteur public d'un Voyageur est
 * descendu à **-1** après un seul passage de `complete-trips`, et le nombre négatif est sorti
 * tel quel sur `GET /users/{slug}/public` : « -1 trajet publié ».
 *
 * La cause n'est pas le calcul du delta, qui est juste, mais son APPLICATION : les deux
 * appelants passaient `{ decrement: 1 }` à Prisma sans plancher. Il suffit d'une dérive — un
 * trajet publié avant que le compteur existe, une incrémentation ratée, une correction manuelle —
 * pour qu'un nombre impossible s'affiche sur une page publique.
 *
 * Écrire une VALEUR plutôt qu'un delta ferme aussi un piège maison : sur Mongo,
 * `{ increment: 1 }` sur un champ ABSENT rend `null`, pas `1`.
 */
describe("clampedCarrierStats — un compteur public ne descend jamais sous zéro", () => {
  const sortiePool = getCarrierStatDeltas("PUBLISHED", "COMPLETED");
  const entreePool = getCarrierStatDeltas("DRAFT", "PUBLISHED");

  it("le delta de sortie du pool public est bien un décrément (la règle reste juste)", () => {
    expect(sortiePool).toEqual({ totalTripsPublished: { decrement: 1 } });
  });

  it("décrémenter un compteur déjà à zéro le laisse à zéro — le cas qui a produit le -1", () => {
    expect(clampedCarrierStats({ totalTripsPublished: 0 }, sortiePool)).toEqual({ totalTripsPublished: 0 });
  });

  it("décrémenter un compteur ABSENT le laisse à zéro, jamais à null", () => {
    expect(clampedCarrierStats({}, sortiePool)).toEqual({ totalTripsPublished: 0 });
    expect(clampedCarrierStats({ totalTripsPublished: null }, sortiePool)).toEqual({ totalTripsPublished: 0 });
  });

  it("un décrément normal reste un décrément", () => {
    expect(clampedCarrierStats({ totalTripsPublished: 3 }, sortiePool)).toEqual({ totalTripsPublished: 2 });
  });

  it("l'incrément part de zéro quand le champ est absent (piège Mongo : `increment` rendrait null)", () => {
    expect(clampedCarrierStats({}, entreePool)).toEqual({ totalTripsPublished: 1 });
    expect(clampedCarrierStats({ totalTripsPublished: 4 }, entreePool)).toEqual({ totalTripsPublished: 5 });
  });

  it("l'annulation incrémente son propre compteur, lui aussi borné", () => {
    const annule = getCarrierStatDeltas("PUBLISHED", "CANCELLED");
    expect(clampedCarrierStats({ totalTripsPublished: 0, totalTripsCancelled: null }, annule)).toEqual({
      totalTripsPublished: 0,
      totalTripsCancelled: 1,
    });
  });

  it("aucune transition, aucune écriture", () => {
    expect(clampedCarrierStats({ totalTripsPublished: 2 }, null)).toBeNull();
    expect(getCarrierStatDeltas("PUBLISHED", "PAUSED")).toBeNull();
  });
});
