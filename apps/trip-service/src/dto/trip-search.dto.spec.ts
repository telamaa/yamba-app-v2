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

/**
 * D99 3C — ESTIMER N'EST PAS FILTRER.
 *
 * `weightKg` fait DEUX choses : il enrichit les cartes (prix pour ce poids) et
 * il exclut les trajets dont la capacité déclarée ne suffit pas
 * (`trip-search.controller.ts`, `buildBaseWhere`). C'est juste pour un poids
 * CHOISI par l'Expéditeur. Ce ne l'est plus pour le poids par DÉFAUT du flux
 * d'atterrissage : il retirerait silencieusement des trajets d'une page
 * intitulée « Tous les trajets disponibles ».
 *
 * `estimateKg` n'a donc que la moitié du pouvoir. Ces fiches gardent la
 * frontière — c'est elle, et non le champ, qui est la décision.
 */
describe("searchTripsQuerySchema — estimateKg estime, il ne filtre pas (D99 3C)", () => {
  const parse = (query: Record<string, unknown>) => {
    const r = searchTripsQuerySchema.safeParse({ locale: "fr", ...query });
    if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return r.data;
  };
  const errorsOn = (query: Record<string, unknown>) => {
    const r = searchTripsQuerySchema.safeParse({ locale: "fr", ...query });
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("est lu depuis la requête, comme une chaîne d'URL", () => {
    // `z.coerce` : tout arrive en chaîne dans une query string.
    expect(parse({ estimateKg: "2" }).estimateKg).toBe(2);
    expect(parse({ estimateKg: "2.5" }).estimateKg).toBe(2.5);
  });

  it("absent par défaut — aucune estimation n'est imposée au serveur", () => {
    expect(parse({}).estimateKg).toBeUndefined();
  });

  it("porte les MÊMES bornes que le poids choisi", () => {
    // Un poids supposé hors bornes serait un défaut du client, pas une
    // tolérance à accorder : 0,5 kg mini, 30 kg maxi des deux côtés.
    expect(errorsOn({ estimateKg: "0.4" })).toContain("estimateKg");
    expect(errorsOn({ estimateKg: "31" })).toContain("estimateKg");
    expect(parse({ estimateKg: "0.5" }).estimateKg).toBe(0.5);
    expect(parse({ estimateKg: "30" }).estimateKg).toBe(30);
  });

  it("cohabite avec weightKg — les deux champs existent séparément", () => {
    // Le contrôleur fait `weightKg ?? estimateKg` pour les CHIFFRES et ne
    // passe que `weightKg` au filtre de capacité et au tri par prix : un poids
    // choisi l'emporte toujours sur un poids supposé.
    const p = parse({ weightKg: "5", estimateKg: "2" });
    expect(p.weightKg).toBe(5);
    expect(p.estimateKg).toBe(2);
  });

  it("une valeur illisible est un 400, pas un silence", () => {
    expect(errorsOn({ estimateKg: "deux kilos" })).toContain("estimateKg");
  });
});
