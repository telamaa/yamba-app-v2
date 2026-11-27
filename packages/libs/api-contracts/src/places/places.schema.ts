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
    /**
     * L'identifiant Google du lieu (D111 ter). Vide quand Google n'en donne
     * pas — le client le traite alors comme « pas de détail disponible »
     * plutôt que d'appeler avec une chaîne vide.
     *
     * Il n'est PAS décoratif : sans lui, un client ne peut obtenir ni code
     * pays ni coordonnées, donc ni corridor ni distance — et sans corridor,
     * pas de fourchette de prix. C'est ce champ manquant qui laissait le
     * téléphone plus pauvre que le site sur l'écran qui décide du revenu.
     */
    placeId: z.string(),
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

/* ── Détail d'un lieu (D111 ter) ──────────────────────────────────────── */

/**
 * GET /places/details?placeId=…&language=…&sessionToken=… → PlaceDetailsResponse
 *
 * Appelé UNE fois, au moment où l'utilisateur CHOISIT une ville — jamais à
 * chaque frappe. Avec le même `sessionToken` que l'autocomplétion qui l'a
 * précédé, Google facture l'ensemble comme UNE session : c'est la raison
 * pour laquelle le jeton voyage jusqu'ici au lieu de s'arrêter à
 * l'autocomplétion.
 */
export const PlaceDetailsQuerySchema = z
  .object({
    /** L'identifiant rendu par l'autocomplétion. */
    placeId: z.string().trim().min(1).max(300),
    language: z.enum(SUPPORTED_LOCALES).optional(),
    sessionToken: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{1,36}$/)
      .optional(),
  })
  .strict()
  .meta({ id: "PlaceDetailsQuery", description: "Paramètres du détail d'un lieu" });
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;

/**
 * Ce qu'un client a besoin de savoir d'un lieu, et rien de plus.
 *
 * Tout est NULLABLE sauf le nom : Google ne garantit aucun de ces champs, et
 * un code pays inventé vaut moins que son absence — le calcul de corridor
 * sait retomber sur sa base de repli, il ne sait pas deviner qu'un code est
 * faux.
 */
export const PlaceDetailsResponseSchema = z
  .object({
    /** La ville (« Paris ») — telle que Google la nomme dans la langue demandée. */
    city: z.string(),
    /** Le pays en toutes lettres (« France »), ou `null`. */
    country: z.string().nullable(),
    /** ISO 3166-1 alpha-2 en MAJUSCULES (« FR »), ou `null`. */
    countryCode: z.string().length(2).nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .strict()
  .meta({
    id: "PlaceDetailsResponse",
    description: "Pays et coordonnées d'un lieu choisi (pour le corridor de prix)",
  });
export type PlaceDetails = z.infer<typeof PlaceDetailsResponseSchema>;
