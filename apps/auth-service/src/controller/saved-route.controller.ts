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

// Helper : normalise un code ISO (uppercase, trim, null si vide)
function normalizeIso(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0
    ? v.trim().toUpperCase()
    : null;
}

// ───────────────────────────────────────────────────────
// POST /api/saved-routes
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
      // Origin
      originCity,
      originCityCode,
      originCountry,
      originCountryCode,
      originRegion,
      originRegionCode,
      originPlaceId,
      originLat,
      originLng,
      // Destination
      destinationCity,
      destinationCityCode,
      destinationCountry,
      destinationCountryCode,
      destinationRegion,
      destinationRegionCode,
      destinationPlaceId,
      destinationLat,
      destinationLng,
      // Period & prefs
      earliestDate,
      latestDate,
      emailEnabled = true,
      includeNearby = true,
    } = req.body as {
      originCity?: string;
      originCityCode?: string | null;
      originCountry?: string;
      originCountryCode?: string;
      originRegion?: string | null;
      originRegionCode?: string | null;
      originPlaceId?: string | null;
      originLat?: number | null;
      originLng?: number | null;
      destinationCity?: string;
      destinationCityCode?: string | null;
      destinationCountry?: string;
      destinationCountryCode?: string;
      destinationRegion?: string | null;
      destinationRegionCode?: string | null;
      destinationPlaceId?: string | null;
      destinationLat?: number | null;
      destinationLng?: number | null;
      earliestDate?: string | null;
      latestDate?: string | null;
      emailEnabled?: boolean;
      includeNearby?: boolean;
    };

    // Validation (les champs ISO optionnels ne sont pas required)
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

    const normalizedOriginCountryCode = normalizeIso(originCountryCode)!;
    const normalizedDestinationCountryCode = normalizeIso(destinationCountryCode)!;

    // Limite : max 20 alertes actives par user
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

    // Détecter doublons (même route active)
    const duplicate = await prisma.savedRoute.findFirst({
      where: {
        userId,
        isActive: true,
        originCity: { equals: originCity!.trim(), mode: "insensitive" },
        destinationCity: { equals: destinationCity!.trim(), mode: "insensitive" },
        originCountryCode: normalizedOriginCountryCode,
        destinationCountryCode: normalizedDestinationCountryCode,
      },
    });
    if (duplicate) {
      return next(new ValidationError("You already have an active alert for this route."));
    }

    const latestDateParsed = latestDate ? new Date(latestDate) : null;
    const expiresAt = computeExpiresAt(latestDateParsed);

    const savedRoute = await prisma.savedRoute.create({
      data: {
        userId,
        // Origin
        originCity: originCity!.trim(),
        originCityCode: normalizeIso(originCityCode),
        originCountry: originCountry!.trim(),
        originCountryCode: normalizedOriginCountryCode,
        originRegion: originRegion?.trim() ?? null,
        originRegionCode: normalizeIso(originRegionCode),
        originPlaceId: originPlaceId ?? null,
        originLat: originLat ?? null,
        originLng: originLng ?? null,
        // Destination
        destinationCity: destinationCity!.trim(),
        destinationCityCode: normalizeIso(destinationCityCode),
        destinationCountry: destinationCountry!.trim(),
        destinationCountryCode: normalizedDestinationCountryCode,
        destinationRegion: destinationRegion?.trim() ?? null,
        destinationRegionCode: normalizeIso(destinationRegionCode),
        destinationPlaceId: destinationPlaceId ?? null,
        destinationLat: destinationLat ?? null,
        destinationLng: destinationLng ?? null,
        // Period & prefs
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
    if (savedRoute.userId !== userId) return next(new ValidationError("Unauthorized."));

    const { earliestDate, latestDate, emailEnabled, includeNearby } = req.body as {
      earliestDate?: string | null;
      latestDate?: string | null;
      emailEnabled?: boolean;
      includeNearby?: boolean;
    };

    if (earliestDate !== undefined && latestDate !== undefined) {
      if (earliestDate && latestDate) {
        const earliest = new Date(earliestDate);
        const latest = new Date(latestDate);
        if (earliest > latest) {
          return next(new ValidationError("Earliest date must be before latest date."));
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
      updateData.expiresAt = computeExpiresAt(latestDateParsed);
      updateData.expiryWarningSentAt = null;
    }
    if (typeof emailEnabled === "boolean") updateData.emailEnabled = emailEnabled;
    if (typeof includeNearby === "boolean") updateData.includeNearby = includeNearby;

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
      return res.status(200).json({ success: true, message: "Route alert removed." });
    }
    if (savedRoute.userId !== userId) return next(new ValidationError("Unauthorized."));

    await prisma.savedRoute.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Route alert removed." });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// POST /api/saved-routes/:id/extend
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
    if (savedRoute.userId !== userId) return next(new ValidationError("Unauthorized."));

    const newExpiresAt = computeExtendedExpiresAt();

    const updated = await prisma.savedRoute.update({
      where: { id },
      data: {
        expiresAt: newExpiresAt,
        expiryWarningSentAt: null,
        isActive: true,
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
