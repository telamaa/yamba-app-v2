/**
 * trip-favorite.controller.ts — D46 favoris de trajets
 * Réponses : 200 TripFavoriteState (idempotent) · 200 FavoriteTripsResponse.
 */
import type { Response, NextFunction } from "express";
import { AuthError, ValidationError } from "@packages/error-handler";
import { resolveViewerLocale } from "@packages/api-contracts";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { addFavorite, listFavoriteTrips, removeFavorite } from "../services/trip-favorite.service";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user?.id) throw new AuthError("Unauthorized", { code: "UNAUTHENTICATED" });
  return String(req.user.id);
}

function requireTripId(req: AuthenticatedRequest): string {
  const { id } = req.params as { id?: string };
  if (!id || !OBJECT_ID.test(id)) throw new ValidationError("Invalid trip id.", { code: "INVALID_ID" });
  return id;
}

export const addTripFavorite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const state = await addFavorite(requireUserId(req), requireTripId(req));
    return res.status(200).json(state);
  } catch (error) {
    return next(error);
  }
};

export const removeTripFavorite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const state = await removeFavorite(requireUserId(req), requireTripId(req));
    return res.status(200).json(state);
  } catch (error) {
    return next(error);
  }
};

export const listMyFavoriteTrips = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    // Dette D-1 — même règle qu'ailleurs : la surcharge explicite, puis la langue du COMPTE
    // (D44), puis celle de l'appareil. `preferredLocale` était ignoré ici.
    const locale = resolveViewerLocale({
      query: typeof req.query.locale === "string" ? req.query.locale : null,
      preferred: (req.user as { preferredLocale?: string | null } | undefined)?.preferredLocale,
      header: req.headers["x-locale"] as string | undefined,
      acceptLanguage: req.headers["accept-language"],
    });
    const page = await listFavoriteTrips(userId, locale);
    return res.status(200).json(page);
  } catch (error) {
    return next(error);
  }
};
