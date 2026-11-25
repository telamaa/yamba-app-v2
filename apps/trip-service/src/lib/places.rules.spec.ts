/**
 * places.rules.spec.ts — la projection de la réponse Google (A211).
 */
import { mapGoogleDetails, mapGoogleSuggestions, placeDetailsCacheKey, placesCacheKey } from "./places.rules";

describe("mapGoogleSuggestions", () => {
  it("garde la ville et son contexte depuis structuredFormat", () => {
    expect(
      mapGoogleSuggestions({
        suggestions: [
          {
            placePrediction: {
              structuredFormat: {
                mainText: { text: "Paris" },
                secondaryText: { text: "France" },
              },
            },
          },
        ],
      })
      // D111 ter — la projection porte aussi l'identifiant du lieu, vide
      // quand Google n'en donne pas.
    ).toEqual([{ main: "Paris", secondary: "France", placeId: "" }]);
  });

  it("retombe sur `text` quand Google n'a pas structuré la prédiction", () => {
    expect(
      mapGoogleSuggestions({ suggestions: [{ placePrediction: { text: { text: "Brazzaville" } } }] })
    ).toEqual([{ main: "Brazzaville", secondary: "", placeId: "" }]);
  });

  it("jette les propositions sans nom plutôt que d'afficher une ligne vide", () => {
    expect(mapGoogleSuggestions({ suggestions: [{ placePrediction: {} }, {}] })).toEqual([]);
  });

  it("plafonne à huit, comme le site", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      placePrediction: { structuredFormat: { mainText: { text: `Ville ${i}` } } },
    }));
    expect(mapGoogleSuggestions({ suggestions: many })).toHaveLength(8);
  });

  it("supporte une réponse vide ou sans le champ `suggestions`", () => {
    expect(mapGoogleSuggestions({})).toEqual([]);
    expect(mapGoogleSuggestions({ suggestions: [] })).toEqual([]);
  });
});

describe("placesCacheKey", () => {
  it("une même frappe, à la casse et aux espaces près, n'est qu'une seule clé", () => {
    expect(placesCacheKey("  Paris ", "fr")).toBe(placesCacheKey("paris", "fr"));
  });

  it("sépare les langues : la réponse de Google en dépend", () => {
    expect(placesCacheKey("paris", "fr")).not.toBe(placesCacheKey("paris", "en"));
  });
});

/* ── Détail d'un lieu (D111 ter) ──────────────────────────────────────── */

describe("l'identifiant du lieu voyage avec la proposition", () => {
  it("il est repris tel quel", () => {
    const projection = mapGoogleSuggestions({
      suggestions: [
        {
          placePrediction: {
            placeId: "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
            structuredFormat: { mainText: { text: "Paris" }, secondaryText: { text: "France" } },
          },
        },
      ],
    });
    expect(projection[0].placeId).toBe("ChIJD7fiBh9u5kcRYJSMaMOCCwQ");
  });

  it("absent chez Google, il vaut la chaîne VIDE — jamais `undefined`", () => {
    // Le client lit « pas de détail disponible » ; un `undefined` traverserait
    // le contrat strict et casserait la réponse entière.
    const projection = mapGoogleSuggestions({
      suggestions: [{ placePrediction: { text: { text: "Paris" } } }],
    });
    expect(projection[0].placeId).toBe("");
  });
});

describe("le détail d'un lieu", () => {
  const paris = {
    location: { latitude: 48.8566, longitude: 2.3522 },
    displayName: { text: "Paris" },
    addressComponents: [
      { longText: "Paris", shortText: "Paris", types: ["locality", "political"] },
      { longText: "France", shortText: "FR", types: ["country", "political"] },
    ],
  };

  it("rend la ville, le pays, son code et les coordonnées", () => {
    expect(mapGoogleDetails(paris)).toEqual({
      city: "Paris",
      country: "France",
      countryCode: "FR",
      lat: 48.8566,
      lng: 2.3522,
    });
  });

  it("une proposition d'AÉROPORT n'a pas toujours de `locality` : le nom affiché prend le relais", () => {
    const roissy = {
      location: { latitude: 49.0097, longitude: 2.5479 },
      displayName: { text: "Aéroport de Paris-Charles-de-Gaulle" },
      addressComponents: [{ longText: "France", shortText: "FR", types: ["country"] }],
    };
    expect(mapGoogleDetails(roissy).city).toBe("Aéroport de Paris-Charles-de-Gaulle");
    expect(mapGoogleDetails(roissy).countryCode).toBe("FR");
  });

  it("le code pays est mis en MAJUSCULES, et refusé s'il ne fait pas deux lettres", () => {
    // Il voyage ensuite jusqu'à une table de zones : un « fr » minuscule y
    // tomberait dans le repli sans que rien ne le dise.
    const minuscule = { addressComponents: [{ shortText: "fr", longText: "France", types: ["country"] }] };
    expect(mapGoogleDetails(minuscule).countryCode).toBe("FR");

    const bizarre = { addressComponents: [{ shortText: "FRA", longText: "France", types: ["country"] }] };
    expect(mapGoogleDetails(bizarre).countryCode).toBeNull();
  });

  it("une coordonnée absente ou non finie devient `null`, jamais `NaN`", () => {
    // `NaN` traverse toutes les comparaisons sans en déclencher une seule :
    // une distance calculée dessus rend `NaN` et la fourchette suit.
    expect(mapGoogleDetails({}).lat).toBeNull();
    expect(mapGoogleDetails({ location: { latitude: Number.NaN, longitude: 2 } }).lat).toBeNull();
    expect(mapGoogleDetails({ location: { latitude: Number.NaN, longitude: 2 } }).lng).toBe(2);
  });

  it("sans composant pays, le pays et son code sont NULS — on n'invente pas", () => {
    const details = mapGoogleDetails({ displayName: { text: "Quelque part" } });
    expect(details.country).toBeNull();
    expect(details.countryCode).toBeNull();
    expect(details.city).toBe("Quelque part");
  });
});

describe("la clé de cache d'un détail", () => {
  it("inclut la LANGUE : la ville et le pays en dépendent", () => {
    expect(placeDetailsCacheKey("abc", "fr")).not.toBe(placeDetailsCacheKey("abc", "en"));
  });

  it("n'inclut PAS le jeton de session — deux sessions partagent la réponse", () => {
    // Google facture la session, pas la lecture : un cache par session ne
    // servirait personne.
    expect(placeDetailsCacheKey("abc", "fr")).toBe("places:det:fr:abc");
  });

  it("ignore les espaces de bord de l'identifiant", () => {
    expect(placeDetailsCacheKey("  abc  ", "fr")).toBe(placeDetailsCacheKey("abc", "fr"));
  });
});
