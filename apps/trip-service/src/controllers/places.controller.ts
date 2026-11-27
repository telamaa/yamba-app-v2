/**
 * places.controller.ts — GET /places/autocomplete (A211)
 * =======================================================
 * Public, comme la recherche qu'il sert : un visiteur doit pouvoir taper
 * une ville avant d'avoir un compte.
 *
 * Deux refus, deux sens :
 *   • 400 `INVALID_QUERY` — la saisie ne respecte pas le contrat (moins de
 *     deux caractères, langue inconnue, jeton de session mal formé) ;
 *   • 503 `PLACES_UNAVAILABLE` — le service tiers ne répond pas. Le client
 *     retombe sur la saisie libre et le DIT ; il ne doit surtout pas
 *     conclure qu'aucune ville ne correspond.
 */
import type { Request, Response, NextFunction } from "express";
import { AppError, NotFoundError, ValidationError } from "@packages/error-handler";
import {
  PlaceAutocompleteQuerySchema,
  PlaceDetailsQuerySchema,
  resolveViewerLocale,
  type PlaceAutocompleteResponse,
  type PlaceDetails,
} from "@packages/api-contracts";

import { lookupPlaceDetails, lookupPlaces } from "../services/places.service";

export const autocompletePlaces = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PlaceAutocompleteQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid autocomplete query", {
        type: "places",
        code: "INVALID_QUERY",
      });
    }

    // La langue explicite prime ; sinon celle de l'écran (`x-locale`, D44).
    // La règle COMMUNE de la langue d'une réponse (dette D-1, D44) : le
    // paramètre explicite, puis la langue du COMPTE, puis celle de
    // l'appareil. La route est `isOptionallyAuthenticated` — un membre
    // connecté reçoit ses propositions dans SA langue, pas celle du
    // téléphone ; un visiteur n'a que l'en-tête.
    const language = resolveViewerLocale({
      query: parsed.data.language ?? null,
      preferred: (req as { user?: { preferredLocale?: string | null } }).user?.preferredLocale,
      header: req.headers["x-locale"] as string | undefined,
      acceptLanguage: req.headers["accept-language"],
    });

    const suggestions = await lookupPlaces({
      input: parsed.data.input,
      language,
      sessionToken: parsed.data.sessionToken,
    });

    if (suggestions === null) {
      throw new AppError("City suggestions are unavailable", 503, true, {
        type: "places",
        code: "PLACES_UNAVAILABLE",
      });
    }

    const body: PlaceAutocompleteResponse = { suggestions };
    // Le service cache déjà 5 minutes côté serveur ; le client, lui, ne doit
    // pas garder une liste qui a changé de langue ou de saisie.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(body);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /places/details — le pays et les coordonnées d'un lieu CHOISI (D111 ter)
 * ============================================================================
 * Public comme l'autocomplétion qui le précède, et appelé UNE fois : au
 * moment où l'utilisateur retient une ville, jamais à chaque frappe.
 *
 * Sans lui, un client qui n'embarque pas le SDK Google (le mobile) ne peut
 * obtenir ni code pays ni coordonnées — donc ni corridor ni distance, donc
 * aucune fourchette de prix. C'est exactement ce qui laissait le téléphone
 * plus pauvre que le site sur l'écran qui décide du revenu du Voyageur.
 *
 * Trois réponses, trois sens :
 *   • 200 — le détail, éventuellement incomplet (un `countryCode` à `null`
 *     vaut mieux qu'un code inventé : le calcul sait retomber sur sa base) ;
 *   • 404 `PLACE_NOT_FOUND` — Google ne connaît pas cet identifiant. Le
 *     client doit refaire sa saisie, pas réessayer ;
 *   • 503 `PLACES_UNAVAILABLE` — le service tiers ne répond pas. Le parcours
 *     continue SANS fourchette, il ne s'arrête pas.
 */
export const getPlaceDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PlaceDetailsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid place details query", {
        type: "places",
        code: "INVALID_QUERY",
      });
    }

    const language = resolveViewerLocale({
      query: parsed.data.language ?? null,
      preferred: (req as { user?: { preferredLocale?: string | null } }).user?.preferredLocale,
      header: req.headers["x-locale"] as string | undefined,
      acceptLanguage: req.headers["accept-language"],
    });

    const details = await lookupPlaceDetails({
      placeId: parsed.data.placeId,
      language,
      sessionToken: parsed.data.sessionToken,
    });

    if (details === "unknown") {
      throw new NotFoundError("Place not found", { type: "places", code: "PLACE_NOT_FOUND" });
    }
    if (details === null) {
      throw new AppError("Place details are unavailable", 503, true, {
        type: "places",
        code: "PLACES_UNAVAILABLE",
      });
    }

    const body: PlaceDetails = details;
    // Le serveur cache déjà 24 h ; le client, lui, ne garde rien — il ne
    // demande ce détail qu'au moment où une ville est retenue.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(body);
  } catch (error) {
    return next(error);
  }
};
