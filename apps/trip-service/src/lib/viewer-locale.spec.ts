import { DEFAULT_LOCALE, resolveLocale, resolveViewerLocale } from "@packages/api-contracts";

/**
 * Dette D-1 du rapport de recette API (fiches API-GW-10, API-MSG-11) — « trancher : soit l'en-tête
 * prime, soit le cahier est corrigé ».
 *
 * L'arbitrage était déjà rendu, au registre : **D44**, « une locale par UTILISATEUR, pas par
 * appareil ». Ce qui manquait n'était pas la décision, c'était son écriture : trois endpoints
 * résolvaient la langue de trois façons différentes — l'un ignorait le membre, l'autre l'en-tête,
 * le troisième répondait toujours en français quand le paramètre manquait.
 *
 * `resolveViewerLocale` est cette règle, écrite une fois. Ce spec la fige.
 */
describe("resolveViewerLocale — une seule règle pour la langue d'une réponse (D-1, D44)", () => {
  it("un paramètre `?locale=` explicite l'emporte : un lien partagé rend toujours la même page", () => {
    expect(resolveViewerLocale({ query: "en", preferred: "fr", header: "fr" })).toBe("en");
    expect(resolveViewerLocale({ query: "fr", preferred: "en", header: "en" })).toBe("fr");
  });

  it("sans paramètre, la langue du COMPTE gagne celle de l'appareil (D44)", () => {
    expect(resolveViewerLocale({ preferred: "en", header: "fr" })).toBe("en");
    expect(resolveViewerLocale({ preferred: "fr", header: "en" })).toBe("fr");
  });

  it("un visiteur sans compte est servi dans la langue de son appareil", () => {
    expect(resolveViewerLocale({ header: "en" })).toBe("en");
    expect(resolveViewerLocale({ preferred: null, header: "en" })).toBe("en");
  });

  it("`Accept-Language` est le dernier recours avant le défaut", () => {
    expect(resolveViewerLocale({ acceptLanguage: "en-US,en;q=0.9,fr;q=0.8" })).toBe("en");
    expect(resolveViewerLocale({})).toBe(DEFAULT_LOCALE);
  });

  it("une source vide ou inconnue est ignorée, pas retenue comme défaut", () => {
    // Le piège : `?locale=de` ne doit pas court-circuiter la préférence du membre au profit du
    // défaut français — une valeur non supportée n'est pas une réponse.
    expect(resolveViewerLocale({ query: "de", preferred: "en" })).toBe("en");
    expect(resolveViewerLocale({ query: "", header: "en" })).toBe("en");
  });

  it("normalise les formes régionales, comme `resolveLocale`", () => {
    expect(resolveViewerLocale({ preferred: "EN-GB" })).toBe("en");
    expect(resolveViewerLocale({ header: "fr_CA" })).toBe("fr");
    expect(resolveViewerLocale({ header: "fr-FR" })).toBe(resolveLocale("fr-FR"));
  });
});
