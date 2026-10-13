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
import { AppError, ValidationError } from "@packages/error-handler";
import {
  PlaceAutocompleteQuerySchema,
  resolveViewerLocale,
  type PlaceAutocompleteResponse,
} from "@packages/api-contracts";

import { lookupPlaces } from "../services/places.service";

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
