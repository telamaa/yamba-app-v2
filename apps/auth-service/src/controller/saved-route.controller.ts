import type { Response, NextFunction } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import {
  computeExpiresAt,
  computeExtendedExpiresAt,
  validateSavedRoutePayload,
} from "../utils/saved-route.helper";

const MAX_SAVED_ROUTES_PER_USER = 20;

// ───────────────────────────────────────────────────────
// POST /api/saved-routes
// Créer une nouvelle alerte de route.
// ───────────────────────────────────────────────────────

export const createSavedRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const userId = req.user.id;
    const {
      originCity,
      originCountry,
      originCountryCode,
      originPlaceId,
      originLat,
      originLng,
      destinationCity,
      destinationCountry,
      destinationCountryCode,
      destinationPlaceId,
      destinationLat,
      destinationLng,
      earliestDate,
      latestDate,
      emailEnabled = true,
      includeNearby = true,
    } = req.body as {
      originCity?: string;
      originCountry?: string;
      originCountryCode?: string;
      originPlaceId?: string | null;
      originLat?: number | null;
      originLng?: number | null;
      destinationCity?: string;
      destinationCountry?: string;
      destinationCountryCode?: string;
      destinationPlaceId?: string | null;
      destinationLat?: number | null;
      destinationLng?: number | null;
      earliestDate?: string | null;
      latestDate?: string | null;
      emailEnabled?: boolean;
      includeNearby?: boolean;
    };

    // Validation
    const error = validateSavedRoutePayload({
      originCity,
      originCountry,
      originCountryCode,
      destinationCity,
      destinationCountry,
      destinationCountryCode,
      earliestDate,
      latestDate,
    });
    if (error) return next(new ValidationError(error));

    // Limite anti-spam : max 20 alertes actives par user
    const activeCount = await prisma.savedRoute.count({
      where: { userId, isActive: true },
    });
    if (activeCount >= MAX_SAVED_ROUTES_PER_USER) {
      return next(
        new ValidationError(
          `You can have a maximum of ${MAX_SAVED_ROUTES_PER_USER} active route alerts. Please remove one before creating a new one.`
        )
      );
    }

    // Détecter les doublons (même route + même userId déjà actifs)
    const duplicate = await prisma.savedRoute.findFirst({
      where: {
        userId,
        isActive: true,
        originCity: { equals: originCity!.trim(), mode: "insensitive" },
        destinationCity: {
          equals: destinationCity!.trim(),
          mode: "insensitive",
        },
        originCountryCode: originCountryCode!.toUpperCase(),
        destinationCountryCode: destinationCountryCode!.toUpperCase(),
      },
    });
    if (duplicate) {
      return next(
        new ValidationError("You already have an active alert for this route.")
      );
    }

    const latestDateParsed = latestDate ? new Date(latestDate) : null;
    const expiresAt = computeExpiresAt(latestDateParsed);

    const savedRoute = await prisma.savedRoute.create({
      data: {
        userId,
        originCity: originCity!.trim(),
        originCountry: originCountry!.trim(),
        originCountryCode: originCountryCode!.toUpperCase(),
        originPlaceId: originPlaceId ?? null,
        originLat: originLat ?? null,
        originLng: originLng ?? null,
        destinationCity: destinationCity!.trim(),
        destinationCountry: destinationCountry!.trim(),
        destinationCountryCode: destinationCountryCode!.toUpperCase(),
        destinationPlaceId: destinationPlaceId ?? null,
        destinationLat: destinationLat ?? null,
        destinationLng: destinationLng ?? null,
        earliestDate: earliestDate ? new Date(earliestDate) : null,
        latestDate: latestDateParsed,
        emailEnabled,
        includeNearby,
        expiresAt,
        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Route alert created.",
      savedRoute,
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// GET /api/saved-routes
// Liste des alertes actives du user connecté.
// ───────────────────────────────────────────────────────

export const listSavedRoutes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const userId = req.user.id;
    const includeInactive = req.query.includeInactive === "true";

    const savedRoutes = await prisma.savedRoute.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      savedRoutes,
      count: savedRoutes.length,
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// PATCH /api/saved-routes/:id
// Mettre à jour une alerte (dates, prefs notif).
// On ne touche pas aux origines/destinations (le user doit en créer une nouvelle).
// ───────────────────────────────────────────────────────

export const updateSavedRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const savedRoute = await prisma.savedRoute.findUnique({ where: { id } });
    if (!savedRoute) return next(new ValidationError("Route alert not found."));
    if (savedRoute.userId !== userId) {
      return next(new ValidationError("Unauthorized."));
    }

    const {
      earliestDate,
      latestDate,
      emailEnabled,
      includeNearby,
    } = req.body as {
      earliestDate?: string | null;
      latestDate?: string | null;
      emailEnabled?: boolean;
      includeNearby?: boolean;
    };

    // Validation des dates si fournies
    if (earliestDate !== undefined && latestDate !== undefined) {
      if (earliestDate && latestDate) {
        const earliest = new Date(earliestDate);
        const latest = new Date(latestDate);
        if (earliest > latest) {
          return next(
            new ValidationError("Earliest date must be before latest date.")
          );
        }
      }
    }

    const updateData: any = {};

    if (earliestDate !== undefined) {
      updateData.earliestDate = earliestDate ? new Date(earliestDate) : null;
    }

    if (latestDate !== undefined) {
      const latestDateParsed = latestDate ? new Date(latestDate) : null;
      updateData.latestDate = latestDateParsed;
      // Recalculer expiresAt si latestDate change
      updateData.expiresAt = computeExpiresAt(latestDateParsed);
      // Reset le flag de warning car nouvelle date
      updateData.expiryWarningSentAt = null;
    }

    if (typeof emailEnabled === "boolean") {
      updateData.emailEnabled = emailEnabled;
    }
    if (typeof includeNearby === "boolean") {
      updateData.includeNearby = includeNearby;
    }

    const updated = await prisma.savedRoute.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Route alert updated.",
      savedRoute: updated,
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// DELETE /api/saved-routes/:id
// Suppression définitive (hard delete).
// ───────────────────────────────────────────────────────

export const deleteSavedRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const savedRoute = await prisma.savedRoute.findUnique({ where: { id } });
    if (!savedRoute) {
      // Idempotent : pas d'erreur si déjà supprimée
      return res
        .status(200)
        .json({ success: true, message: "Route alert removed." });
    }
    if (savedRoute.userId !== userId) {
      return next(new ValidationError("Unauthorized."));
    }

    await prisma.savedRoute.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Route alert removed.",
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// POST /api/saved-routes/:id/extend
// Prolonge une alerte de 6 mois supplémentaires.
// Utilisé depuis l'email de relance pré-expiration.
// ───────────────────────────────────────────────────────

export const extendSavedRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const savedRoute = await prisma.savedRoute.findUnique({ where: { id } });
    if (!savedRoute) return next(new ValidationError("Route alert not found."));
    if (savedRoute.userId !== userId) {
      return next(new ValidationError("Unauthorized."));
    }

    const newExpiresAt = computeExtendedExpiresAt();

    const updated = await prisma.savedRoute.update({
      where: { id },
      data: {
        expiresAt: newExpiresAt,
        expiryWarningSentAt: null, // reset pour pouvoir relancer plus tard
        isActive: true, // au cas où elle était inactive
      },
    });

    return res.status(200).json({
      success: true,
      message: "Route alert extended by 6 months.",
      savedRoute: updated,
    });
  } catch (error) {
    return next(error);
  }
};
