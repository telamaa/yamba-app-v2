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

  /**
   * ANO-API-24 (mesurée le 29/09/2026, lot D80) — le `nextCursor` des tris calculés en mémoire
   * (`o:<n>`, D33 prix-au-poids) était REFUSÉ par cette même regex au retour : la page 2 du tri
   * était inatteignable (400). La forme offset est désormais un curseur légitime.
   */
  it.each(["o:0", "o:10", "o:999999"])("accepte le curseur-offset %p (ANO-API-24)", (cursor) => {
    expect(errorsOn({ cursor })).toEqual([]);
  });

  it.each(["o:", "o:abc", "o:-1", "o:1234567", "O:10"])("refuse l'offset mal formé %p", (cursor) => {
    expect(errorsOn({ cursor })).toContain("cursor");
  });
});

/** D80 — le défaut du contrat est la pertinence, et l'ancrage est une entrée tolérante. */
describe("searchTripsQuerySchema — tri par défaut et ancrage (D80)", () => {
  const parse = (q: Record<string, unknown>) => searchTripsQuerySchema.parse(q);

  it("sans `sort`, le défaut est relevance — le front ne décide pas", () => {
    expect(parse({}).sort).toBe("relevance");
  });

  it.each(["pertinence", "EARLIEST", "42", ""])("un tri inconnu (%p) dégrade sur relevance, comme `mode` (ANO-API-10)", (sort) => {
    expect(parse({ sort }).sort).toBe("relevance");
  });

  it.each(["earliest", "lowestPrice", "bestRated", "relevance"])("un tri valide (%p) est conservé", (sort) => {
    expect(parse({ sort }).sort).toBe(sort);
  });

  it("l'ancrage est coercé depuis la query string", () => {
    const r = parse({ nearLat: "4.05", nearLng: "9.7" });
    expect(r.nearLat).toBeCloseTo(4.05);
    expect(r.nearLng).toBeCloseTo(9.7);
  });

  it.each([
    ["nearLat", "91"],
    ["nearLat", "abc"],
    ["nearLng", "-181"],
    ["nearCountry", "France"],
    ["nearCountry", "C3"],
  ])("un %s invalide (%p) est IGNORÉ, jamais un 400 — une géoloc ne casse pas une recherche", (key, value) => {
    const r = parse({ [key]: value });
    expect(r[key as "nearLat" | "nearLng" | "nearCountry"]).toBeUndefined();
  });

  it("le pays de l'ancrage est normalisé en majuscules (ISO alpha-2)", () => {
    expect(parse({ nearCountry: "cm" }).nearCountry).toBe("CM");
    expect(parse({ nearCountry: "FR" }).nearCountry).toBe("FR");
  });
});
