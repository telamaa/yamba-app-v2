import { searchTripsQuerySchema } from "./trip-search.dto";

/**
 * ANO-API-01 (recette API 08/09/2026, fiches API-GW-15 / API-GW-20) — un curseur mal
 * formé atteignait Prisma et remontait en 500 P2023 « Malformed ObjectID ». Le cas le
 * plus courant est le client qui renvoie littéralement son `nextCursor` null, sérialisé
 * en la chaîne « null ».
 */
describe("searchTripsQuerySchema — le curseur est une entrée utilisateur comme une autre", () => {
  const errorsOn = (query: Record<string, unknown>) => {
    const r = searchTripsQuerySchema.safeParse(query);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it.each(["null", "abc", "pas-un-objectid", "665f1c2ab3d4e5f6a7b8c9d", "665f1c2ab3d4e5f6a7b8c9d0z"])(
    "refuse le curseur %p",
    (cursor) => {
      expect(errorsOn({ cursor })).toContain("cursor");
    }
  );

  it("accepte un ObjectId bien formé, en minuscules comme en majuscules", () => {
    expect(errorsOn({ cursor: "665f1c2ab3d4e5f6a7b8c9d0" })).toEqual([]);
    expect(errorsOn({ cursor: "665F1C2AB3D4E5F6A7B8C9D0" })).toEqual([]);
  });

  it("le curseur reste facultatif", () => {
    expect(errorsOn({})).toEqual([]);
  });

  it("une chaîne VIDE vaut « pas de curseur » (?cursor= toujours envoyé par le client)", () => {
    const r = searchTripsQuerySchema.safeParse({ cursor: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.cursor).toBeUndefined();
  });

  it("borne toujours limit à 50 (non-régression du garde-fou voisin)", () => {
    expect(errorsOn({ limit: "51" })).toContain("limit");
  });
});
