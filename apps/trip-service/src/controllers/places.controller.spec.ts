/**
 * places.controller.spec.ts — GET /places/autocomplete (A211).
 * =============================================================
 * Le point de la journée du 13/10 : un service tiers muet ne doit PAS se
 * lire « aucune ville trouvée » côté client. D'où un 503 porteur d'un code,
 * distinct d'une liste vide.
 */
const lookupPlaces = jest.fn();
jest.mock("../services/places.service", () => ({ lookupPlaces: (...args: unknown[]) => lookupPlaces(...args) }));

import { autocompletePlaces } from "./places.controller";

type Captured = { status: number | null; body: unknown; headers: Record<string, string> };

function run(
  query: Record<string, unknown>,
  headers: Record<string, unknown> = {},
  user?: { preferredLocale?: string | null }
) {
  const captured: Captured = { status: null, body: null, headers: {} };
  const next = jest.fn();
  const res = {
    setHeader: (k: string, v: string) => {
      captured.headers[k] = v;
    },
    status: (code: number) => {
      captured.status = code;
      return {
        json: (body: unknown) => {
          captured.body = body;
        },
      };
    },
  };
  return autocompletePlaces({ query, headers, user } as never, res as never, next).then(() => ({
    captured,
    next,
  }));
}

beforeEach(() => lookupPlaces.mockReset());

describe("GET /places/autocomplete", () => {
  it("rend les propositions du service, sans enveloppe superflue", async () => {
    lookupPlaces.mockResolvedValue([{ main: "Paris", secondary: "France" }]);
    const { captured, next } = await run({ input: "Par", language: "fr" });
    expect(next).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ suggestions: [{ main: "Paris", secondary: "France" }] });
    expect(captured.headers["Cache-Control"]).toBe("no-store");
  });

  it("une liste VIDE reste un 200 : aucune ville ne correspond, le service va bien", async () => {
    lookupPlaces.mockResolvedValue([]);
    const { captured } = await run({ input: "zzzz" });
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ suggestions: [] });
  });

  it("service indisponible → 503 PLACES_UNAVAILABLE (jamais une liste vide)", async () => {
    lookupPlaces.mockResolvedValue(null);
    const { captured, next } = await run({ input: "Paris" });
    expect(captured.status).toBeNull();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(503);
    expect(error.details).toEqual({ type: "places", code: "PLACES_UNAVAILABLE" });
  });

  it("moins de deux caractères → 400 INVALID_QUERY, sans appeler Google", async () => {
    const { next } = await run({ input: "P" });
    expect(lookupPlaces).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ type: "places", code: "INVALID_QUERY" });
  });

  it("paramètre inconnu refusé (contrat strict) et jeton de session mal formé refusé", async () => {
    const { next: n1 } = await run({ input: "Paris", radius: "20" });
    expect(n1.mock.calls[0][0].statusCode).toBe(400);
    const { next: n2 } = await run({ input: "Paris", sessionToken: "jeton avec espaces" });
    expect(n2.mock.calls[0][0].statusCode).toBe(400);
  });

  it("sans `language`, la langue de l'écran (x-locale) décide — défaut FR", async () => {
    lookupPlaces.mockResolvedValue([]);
    await run({ input: "Paris" }, { "x-locale": "en" });
    expect(lookupPlaces).toHaveBeenCalledWith({ input: "Paris", language: "en", sessionToken: undefined });
    await run({ input: "Paris" }, {});
    expect(lookupPlaces).toHaveBeenLastCalledWith({ input: "Paris", language: "fr", sessionToken: undefined });
  });

  it("la langue du COMPTE prime sur celle de l'appareil (D44, règle commune)", async () => {
    lookupPlaces.mockResolvedValue([]);
    await run({ input: "Paris" }, { "x-locale": "fr" }, { preferredLocale: "en" });
    expect(lookupPlaces).toHaveBeenCalledWith({ input: "Paris", language: "en", sessionToken: undefined });
  });

  it("…mais le paramètre explicite prime sur tout", async () => {
    lookupPlaces.mockResolvedValue([]);
    await run({ input: "Paris", language: "fr" }, { "x-locale": "en" }, { preferredLocale: "en" });
    expect(lookupPlaces).toHaveBeenCalledWith({ input: "Paris", language: "fr", sessionToken: undefined });
  });

  it("le jeton de session est RELAYÉ tel quel : c'est lui qui groupe la facturation Google", async () => {
    lookupPlaces.mockResolvedValue([]);
    await run({ input: "Paris", sessionToken: "m4k2x9-ab12cd34" });
    expect(lookupPlaces).toHaveBeenCalledWith({
      input: "Paris",
      language: "fr",
      sessionToken: "m4k2x9-ab12cd34",
    });
  });
});
