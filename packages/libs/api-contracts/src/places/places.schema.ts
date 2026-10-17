/**
 * places.schema.ts — l'autocomplétion de villes, servie par NOTRE API
 * ===================================================================
 * GET /places/autocomplete?input=…&language=…&sessionToken=… → PlaceAutocompleteResponse
 *
 * Pourquoi un relais plutôt qu'un appel direct à Google depuis le client :
 * une clé Google utilisable par une application mobile devrait voyager DANS
 * le bundle (une clé restreinte par referer est refusée — un `fetch` natif
 * n'envoie pas de referer, et la signature d'app n'accompagne que les SDK
 * Maps). Une clé embarquée est extractible, donc facturable par n'importe
 * qui. Ici la clé reste sur le serveur, la limitation de débit est la nôtre,
 * et les deux fronts peuvent converger sur le même contrat.
 *
 * Le `sessionToken` est RELAYÉ tel quel : la facturation de Google groupe
 * les frappes d'une même saisie sous un jeton de session — le client, seul à
 * savoir quand une saisie commence et finit, le fabrique ; nous le
 * transmettons.
 */
import { z } from "zod";
import { SUPPORTED_LOCALES } from "../locale";

/** Deux caractères minimum (la règle du site) ; cent suffisent à toute ville. */
export const PlaceAutocompleteQuerySchema = z
  .object({
    input: z.string().trim().min(2).max(100),
    language: z.enum(SUPPORTED_LOCALES).optional(),
    /** Opaque, fabriqué par le client — URL-safe, 36 caractères au plus (convention Google). */
    sessionToken: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{1,36}$/)
      .optional(),
  })
  .strict()
  .meta({
    id: "PlaceAutocompleteQuery",
    description: "Paramètres de l'autocomplétion de villes",
  });
export type PlaceAutocompleteQuery = z.infer<typeof PlaceAutocompleteQuerySchema>;

export const PlaceSuggestionSchema = z
  .object({
    /** La ville seule (« Paris ») — ce qui part dans la recherche. */
    main: z.string(),
    /** Le contexte (« France », « Texas, États-Unis ») — affiché en second. */
    secondary: z.string(),
  })
  .strict()
  .meta({ id: "PlaceSuggestion", description: "Une proposition de ville ou d'aéroport" });
export type PlaceSuggestion = z.infer<typeof PlaceSuggestionSchema>;

export const PlaceAutocompleteResponseSchema = z
  .object({
    suggestions: z.array(PlaceSuggestionSchema),
  })
  .strict()
  .meta({
    id: "PlaceAutocompleteResponse",
    description: "Propositions de villes (8 au plus, dans la langue demandée)",
  });
export type PlaceAutocompleteResponse = z.infer<typeof PlaceAutocompleteResponseSchema>;

/**
 * Codes de refus (details.type = "places").
 * `PLACES_UNAVAILABLE` : clé absente, quota épuisé, Google muet. Le client
 * retombe sur la saisie LIBRE — l'autocomplétion est un confort, jamais un
 * préalable (A207) ; il ne doit SURTOUT pas dire « aucune ville trouvée ».
 */
export const PLACES_ERROR_CODES = ["PLACES_UNAVAILABLE"] as const;
export type PlacesErrorCode = (typeof PLACES_ERROR_CODES)[number];

/** Huit, comme le site (`CityAutocomplete`, `preds.slice(0, 8)`). */
export const PLACES_MAX_SUGGESTIONS = 8;
