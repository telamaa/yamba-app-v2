/**
 * places.rules.spec.ts — la projection de la réponse Google (A211).
 */
import { mapGoogleSuggestions, placesCacheKey } from "./places.rules";

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
    ).toEqual([{ main: "Paris", secondary: "France" }]);
  });

  it("retombe sur `text` quand Google n'a pas structuré la prédiction", () => {
    expect(
      mapGoogleSuggestions({ suggestions: [{ placePrediction: { text: { text: "Brazzaville" } } }] })
    ).toEqual([{ main: "Brazzaville", secondary: "" }]);
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
