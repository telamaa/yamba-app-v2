import type {Response, NextFunction, RequestHandler} from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import imagekit from "../lib/imagekit";
// ⭐ NEW : helpers pour auto-populer les champs dénormalisés
import {
  computeMinPriceCents,
  computeHourLocal,
} from "../lib/trip-mappers";


// ─────────────────────────────────────────────
// Helper interne : recalcule les champs dénormalisés
// (minPriceCents, departureHourLocal) depuis le payload courant
// ─────────────────────────────────────────────

function computeDenormalizedFields(input: {
  categoryConditions?: Array<{ priceAmountCents: number }>;
  departureAt?: Date | null;
  originTimezone?: string | null;
}): { minPriceCents: number | null; departureHourLocal: number | null } {
  const minPriceCents = computeMinPriceCents(
    (input.categoryConditions ?? []) as any
  );
  const departureHourLocal =
    input.departureAt && input.originTimezone
      ? computeHourLocal(input.departureAt, input.originTimezone)
      : input.departureAt
        ? computeHourLocal(input.departureAt, "Europe/Paris") // fallback
        : null;
  return { minPriceCents, departureHourLocal };
}

// ─────────────────────────────────────────────
// POST /api/trips
// Créer un nouveau trip (brouillon ou publié)
// ─────────────────────────────────────────────

export const createTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const userId = req.user.id;
    const {
      // Trajet
      transportMode,
      tripType,
      originLabel,
      originPlaceId,
      originCity,
      originCityCode,         // ⭐ NEW
      originRegion,
      originCountry,
      originLat,
      originLng,
      originTimezone,         // ⭐ NEW
      destinationLabel,
      destinationPlaceId,
      destinationCity,
      destinationCityCode,    // ⭐ NEW
      destinationRegion,
      destinationCountry,
      destinationLat,
      destinationLng,
      destinationTimezone,    // ⭐ NEW
      // Dates
      departureDateLocal,
      arrivalDateLocal,
      departureTimeLocal,
      arrivalTimeLocal,
      departureAt,
      arrivalAt,
      returnDepartureAt,
      returnArrivalAt,
      // Mode-specific
      flightType,
      trainTripType,
      carTripFlexibility,
      flightLayoverCities,
      trainStopCities,
      travelReference,
      // Conditions
      acceptedCategories,
      categoryConditions,
      handDeliveryOnly,
      instantBooking,
      currencyCode,
      maxSlots,               // ⭐ NEW
      notes,
      // Publication
      publish,
    } = req.body;

    if (!transportMode) {
      return next(new ValidationError("Transport mode is required."));
    }
    if (!originCity || !destinationCity) {
      return next(new ValidationError("Origin and destination are required."));
    }
    if (departureAt && new Date(departureAt) < new Date()) {
      return next(new ValidationError("Departure date must be in the future."));
    }

    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: {
        id: true,
        onboardingStep: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        ratingsAvg: true,    // ⭐ NEW : pour le snapshot au publish
        ratingsCount: true,
      },
    });

    const shouldPublish = publish === true;

    if (shouldPublish) {
      if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
        return next(
          new ValidationError("Carrier profile must be completed to publish a trip.")
        );
      }
      if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
        return next(
          new ValidationError("Stripe must be configured to publish a trip.")
        );
      }
    }

    // ⭐ NEW : calcul des champs dénormalisés
    const departureAtDate = departureAt ? new Date(departureAt) : null;
    const { minPriceCents, departureHourLocal } = computeDenormalizedFields({
      categoryConditions,
      departureAt: departureAtDate,
      originTimezone,
    });

    // ⭐ NEW : snapshot rating SEULEMENT si publication immédiate
    const carrierRatingSnapshot =
      shouldPublish && carrierPage && carrierPage.ratingsCount > 0
        ? carrierPage.ratingsAvg
        : null;

    const trip = await prisma.trip.create({
      data: {
        userId,
        carrierPageId: carrierPage?.id ?? null,
        status: shouldPublish ? "PUBLISHED" : "DRAFT",
        currentStep: shouldPublish ? 3 : 1,
        // Trajet
        transportMode,
        tripType: tripType ?? "ONE_WAY",
        originLabel: originLabel?.trim() ?? null,
        originPlaceId: originPlaceId ?? null,
        originCity: originCity?.trim() ?? null,
        originCityCode: originCityCode?.trim() ?? null,           // ⭐ NEW
        originRegion: originRegion?.trim() ?? null,
        originCountry: originCountry?.trim() ?? null,
        originLat: originLat ?? null,
        originLng: originLng ?? null,
        originTimezone: originTimezone?.trim() ?? null,           // ⭐ NEW
        destinationLabel: destinationLabel?.trim() ?? null,
        destinationPlaceId: destinationPlaceId ?? null,
        destinationCity: destinationCity?.trim() ?? null,
        destinationCityCode: destinationCityCode?.trim() ?? null, // ⭐ NEW
        destinationRegion: destinationRegion?.trim() ?? null,
        destinationCountry: destinationCountry?.trim() ?? null,
        destinationLat: destinationLat ?? null,
        destinationLng: destinationLng ?? null,
        destinationTimezone: destinationTimezone?.trim() ?? null, // ⭐ NEW
        // Dates
        departureDateLocal: departureDateLocal ?? null,
        arrivalDateLocal: arrivalDateLocal ?? null,
        departureTimeLocal: departureTimeLocal ?? null,
        arrivalTimeLocal: arrivalTimeLocal ?? null,
        departureAt: departureAtDate,
        arrivalAt: arrivalAt ? new Date(arrivalAt) : null,
        returnDepartureAt: returnDepartureAt ? new Date(returnDepartureAt) : null,
        returnArrivalAt: returnArrivalAt ? new Date(returnArrivalAt) : null,
        // Mode-specific
        flightType: flightType ?? null,
        trainTripType: trainTripType ?? null,
        carTripFlexibility: carTripFlexibility ?? null,
        flightLayoverCities: flightLayoverCities ?? [],
        trainStopCities: trainStopCities ?? [],
        travelReference: travelReference?.trim() ?? null,
        // Conditions
        acceptedCategories: acceptedCategories ?? [],
        categoryConditions: categoryConditions ?? [],
        handDeliveryOnly: handDeliveryOnly ?? false,
        instantBooking: instantBooking ?? false,
        currencyCode: currencyCode ?? "EUR",
        maxSlots: maxSlots ?? null,                               // ⭐ NEW
        notes: notes?.trim() ?? null,
        // ⭐ NEW : champs dénormalisés
        minPriceCents,
        departureHourLocal,
        carrierRatingSnapshot,
        // Publication
        publishedAt: shouldPublish ? new Date() : null,
      },
      include: {
        documents: true,
      },
    });

    if (shouldPublish && carrierPage) {
      await prisma.carrierPage.update({
        where: { id: carrierPage.id },
        data: { totalTripsPublished: { increment: 1 } },
      });
    }

    return res.status(201).json({
      success: true,
      message: shouldPublish ? "Trip published!" : "Draft saved.",
      trip,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// PUT /api/trips/:id
// Mettre à jour un trip (brouillon ou publié)
// ─────────────────────────────────────────────

export const updateTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));
    if (trip.status === "CANCELLED") {
      return next(new ValidationError("Cannot edit a cancelled trip."));
    }

    const { publish, ...updateData } = req.body;

    // Conversion des dates si présentes
    if (updateData.departureAt) updateData.departureAt = new Date(updateData.departureAt);
    if (updateData.arrivalAt) updateData.arrivalAt = new Date(updateData.arrivalAt);
    if (updateData.returnDepartureAt) updateData.returnDepartureAt = new Date(updateData.returnDepartureAt);
    if (updateData.returnArrivalAt) updateData.returnArrivalAt = new Date(updateData.returnArrivalAt);

    // ⭐ NEW : recalcul des champs dénormalisés si les sources changent
    // (categoryConditions, departureAt, originTimezone)
    const willRecomputePrice = "categoryConditions" in updateData;
    const willRecomputeHour =
      "departureAt" in updateData || "originTimezone" in updateData;

    if (willRecomputePrice || willRecomputeHour) {
      const recomputed = computeDenormalizedFields({
        categoryConditions:
          updateData.categoryConditions ?? (trip.categoryConditions as any),
        departureAt: updateData.departureAt ?? trip.departureAt,
        originTimezone: updateData.originTimezone ?? trip.originTimezone,
      });
      if (willRecomputePrice) {
        updateData.minPriceCents = recomputed.minPriceCents;
      }
      if (willRecomputeHour) {
        updateData.departureHourLocal = recomputed.departureHourLocal;
      }
    }

    // Si on publie pour la première fois
    if (publish === true && trip.status === "DRAFT") {
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: {
          id: true,
          onboardingStep: true,
          stripeOnboardingComplete: true,
          stripeChargesEnabled: true,
          ratingsAvg: true,    // ⭐ NEW
          ratingsCount: true,
        },
      });

      if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
        return next(
          new ValidationError("Carrier profile must be completed to publish a trip.")
        );
      }
      if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
        return next(
          new ValidationError("Stripe must be configured to publish a trip.")
        );
      }

      updateData.status = "PUBLISHED";
      updateData.publishedAt = new Date();
      updateData.currentStep = 3;

      // ⭐ NEW : snapshot du rating au moment du publish
      updateData.carrierRatingSnapshot =
        carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

      await prisma.carrierPage.update({
        where: { id: carrierPage.id },
        data: { totalTripsPublished: { increment: 1 } },
      });
    }

    const updated = await prisma.trip.update({
      where: { id },
      data: updateData,
      include: { documents: true },
    });

    return res.status(200).json({
      success: true,
      message: "Trip updated.",
      trip: updated,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/documents
// (inchangé)
// ─────────────────────────────────────────────

export const addTripDocuments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { documents: { select: { id: true, fileId: true } } },
    });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    const { documents } = req.body as {
      documents: Array<{
        type: string;
        fileId: string;
        url: string;
        originalName?: string;
        mimeType?: string;
        sizeBytes?: number;
        title?: string;
        description?: string;
      }>;
    };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return next(new ValidationError("At least one document is required."));
    }

    const existingFileIds = new Set(trip.documents.map((d) => d.fileId));
    const newDocuments = documents.filter((d) => !existingFileIds.has(d.fileId));

    if (newDocuments.length === 0) {
      const updatedTrip = await prisma.trip.findUnique({
        where: { id },
        include: { documents: true },
      });
      return res.status(200).json({
        success: true,
        message: "No new documents to add.",
        trip: updatedTrip,
      });
    }

    const siteConfig = await prisma.siteConfig.findFirst();
    const maxDocs = siteConfig?.maxDocsPerTrip ?? 5;
    const currentCount = trip.documents.length;

    if (currentCount + newDocuments.length > maxDocs) {
      return next(
        new ValidationError(
          `Maximum ${maxDocs} documents per trip. Currently ${currentCount}.`
        )
      );
    }

    const maxSizeMb = siteConfig?.maxDocSizeMb ?? 5;
    for (const doc of newDocuments) {
      if (!doc.type || !doc.fileId || !doc.url) {
        return next(
          new ValidationError("Each document must have type, fileId, and url.")
        );
      }
      if (doc.sizeBytes && doc.sizeBytes > maxSizeMb * 1024 * 1024) {
        return next(
          new ValidationError(
            `Document "${doc.originalName}" exceeds ${maxSizeMb}MB limit.`
          )
        );
      }
    }

    const created = await prisma.tripDocument.createMany({
      data: newDocuments.map((doc) => ({
        tripId: id,
        uploadedByUserId: userId,
        type: doc.type as any,
        fileId: doc.fileId,
        url: doc.url,
        originalName: doc.originalName ?? null,
        mimeType: doc.mimeType ?? null,
        sizeBytes: doc.sizeBytes ?? null,
        title: doc.title?.trim() ?? null,
        description: doc.description?.trim() ?? null,
        status: "PENDING",
      })),
    });

    const hasTicket = newDocuments.some((d) => d.type === "TICKET_PROOF");
    if (hasTicket && trip.ticketVerificationStatus === "NOT_SUBMITTED") {
      await prisma.trip.update({
        where: { id },
        data: { ticketVerificationStatus: "PENDING" },
      });
    }

    const updatedTrip = await prisma.trip.findUnique({
      where: { id },
      include: { documents: true },
    });

    return res.status(201).json({
      success: true,
      message: `${created.count} document(s) added.`,
      trip: updatedTrip,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/trips/:id/documents/:documentId
// (inchangé)
// ─────────────────────────────────────────────

export const removeTripDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id, documentId } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { documents: { select: { id: true, type: true } } },
    });
    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    const doc = await prisma.tripDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc || doc.tripId !== id) {
      return next(new ValidationError("Document not found."));
    }

    if (doc.fileId) {
      try {
        await imagekit.deleteFile(doc.fileId);
      } catch (err: any) {
        console.warn(
          `[ImageKit] Failed to delete file ${doc.fileId}:`,
          err?.message
        );
      }
    }

    await prisma.tripDocument.delete({ where: { id: documentId } });

    const remainingTickets = trip.documents.filter(
      (d) => d.id !== documentId && d.type === "TICKET_PROOF"
    );
    if (doc.type === "TICKET_PROOF" && remainingTickets.length === 0) {
      await prisma.trip.update({
        where: { id },
        data: { ticketVerificationStatus: "NOT_SUBMITTED" },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document removed.",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/trips/:id (soft delete → CANCELLED)
// (inchangé)
// ─────────────────────────────────────────────

export const cancelTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status === "CANCELLED") {
      return next(new ValidationError("Trip is already cancelled."));
    }

    if (trip.status === "COMPLETED") {
      return next(new ValidationError("Cannot cancel a completed trip."));
    }

    const wasPublished = trip.status === "PUBLISHED";

    await prisma.trip.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    if (wasPublished) {
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (carrierPage) {
        await prisma.carrierPage.update({
          where: { id: carrierPage.id },
          data: {
            totalTripsPublished: { decrement: 1 },
            totalTripsCancelled: { increment: 1 },
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Trip cancelled.",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/restore
// (inchangé)
// ─────────────────────────────────────────────

export const restoreTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status !== "CANCELLED") {
      return next(new ValidationError("Only cancelled trips can be restored."));
    }

    if (trip.departureAt && new Date(trip.departureAt) < new Date()) {
      return next(
        new ValidationError("Cannot restore a trip whose departure date has passed.")
      );
    }

    await prisma.trip.update({
      where: { id },
      data: {
        status: "DRAFT",
        cancelledAt: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Trip restored as draft.",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/trips/:id
// (inchangé)
// ─────────────────────────────────────────────

export const getTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        documents: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: { select: { url: true } },
          },
        },
        carrierPage: {
          select: {
            id: true,
            name: true,
            ratingsAvg: true,
            ratingsCount: true,
            isVerified: true,
          },
        },
      },
    });

    if (!trip) return next(new ValidationError("Trip not found."));

    return res.status(200).json({
      success: true,
      trip,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/trips/my
// (inchangé)
// ─────────────────────────────────────────────

export const getMyTrips = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const userId = req.user.id;
    const { status } = req.query;

    const where: any = { userId };
    if (status && typeof status === "string") {
      where.status = status.toUpperCase();
    }

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        documents: {
          select: { id: true, type: true, status: true, url: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/publish
// ─────────────────────────────────────────────

export const publishTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status !== "DRAFT") {
      return next(new ValidationError("Only drafts can be published."));
    }

    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: {
        id: true,
        onboardingStep: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        ratingsAvg: true,    // ⭐ NEW
        ratingsCount: true,
      },
    });

    if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
      return next(
        new ValidationError("Carrier profile must be completed to publish a trip.")
      );
    }
    if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
      return next(
        new ValidationError("Stripe must be configured to publish a trip.")
      );
    }

    if (!trip.transportMode) {
      return next(new ValidationError("Transport mode is required to publish."));
    }
    if (!trip.originCity || !trip.destinationCity) {
      return next(new ValidationError("Origin and destination are required to publish."));
    }
    if (!trip.departureAt) {
      return next(new ValidationError("Departure date is required to publish."));
    }
    if (new Date(trip.departureAt) < new Date()) {
      return next(new ValidationError("Departure date must be in the future."));
    }
    if (!trip.acceptedCategories || trip.acceptedCategories.length === 0) {
      return next(new ValidationError("At least one parcel category must be accepted."));
    }

    // ⭐ NEW : snapshot du rating
    const carrierRatingSnapshot =
      carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

    await prisma.trip.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        currentStep: 3,
        carrierRatingSnapshot,    // ⭐ NEW
      },
    });

    await prisma.carrierPage.update({
      where: { id: carrierPage.id },
      data: { totalTripsPublished: { increment: 1 } },
    });

    return res.status(200).json({
      success: true,
      message: "Trip published!",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/unpublish (inchangé)
// ─────────────────────────────────────────────

export const unpublishTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status !== "PUBLISHED" && trip.status !== "PAUSED") {
      return next(
        new ValidationError("Only published or paused trips can be reverted to draft.")
      );
    }

    const wasPublished = trip.status === "PUBLISHED";

    await prisma.trip.update({
      where: { id },
      data: {
        status: "DRAFT",
        publishedAt: null,
        currentStep: 1,
      },
    });

    if (wasPublished) {
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (carrierPage) {
        await prisma.carrierPage.update({
          where: { id: carrierPage.id },
          data: { totalTripsPublished: { decrement: 1 } },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Trip reverted to draft.",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/pause (inchangé)
// ─────────────────────────────────────────────

export const pauseTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status !== "PUBLISHED") {
      return next(new ValidationError("Only published trips can be paused."));
    }

    await prisma.trip.update({
      where: { id },
      data: { status: "PAUSED" },
    });

    return res.status(200).json({
      success: true,
      message: "Trip paused.",
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/resume (inchangé)
// ─────────────────────────────────────────────

export const resumeTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    if (trip.status !== "PAUSED") {
      return next(new ValidationError("Only paused trips can be resumed."));
    }

    if (trip.departureAt && new Date(trip.departureAt) < new Date()) {
      return next(new ValidationError("Cannot resume a trip whose departure date has passed."));
    }

    await prisma.trip.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });

    return res.status(200).json({
      success: true,
      message: "Trip resumed.",
    });
  } catch (error) {
    return next(error);
  }
};


/**
 * GET /trips/:id/public
 * Récupérer un trip publié pour la page détail (accessible aux anonymes)
 *
 * Comportement :
 *   - 404 si le trip n'existe pas
 *   - 404 si le trip n'est pas en statut PUBLISHED
 *   - Retourne un DTO épuré (sans email/phone, sans IDs Stripe)
 *
 * Ne pas confondre avec getTrip() qui est protégé et retourne tout.
 */


export const getPublicTrip: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      next(new ValidationError("Invalid trip id."));
      return;
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            avatar: { select: { url: true } },
            carrierPage: {
              select: {
                id: true,
                name: true,
                bio: true,
                isVerified: true,
                isSuperCarrier: true,
                ratingsAvg: true,
                ratingsCount: true,
                totalTripsPublished: true,
                totalParcelsCarried: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      res.status(404).json({ success: false, message: "Trip not found." });
      return;
    }

    if (trip.status !== "PUBLISHED") {
      res.status(404).json({ success: false, message: "Trip not found." });
      return;
    }

    const carrierPage = trip.user.carrierPage;

    const publicDto = {
      id: trip.id,
      status: trip.status,
      transportMode: trip.transportMode,
      tripType: trip.tripType,

      origin: {
        label: trip.originLabel,
        city: trip.originCity,
        cityCode: trip.originCityCode,
        region: trip.originRegion,
        country: trip.originCountry,
        lat: trip.originLat,
        lng: trip.originLng,
        timezone: trip.originTimezone,
      },
      destination: {
        label: trip.destinationLabel,
        city: trip.destinationCity,
        cityCode: trip.destinationCityCode,
        region: trip.destinationRegion,
        country: trip.destinationCountry,
        lat: trip.destinationLat,
        lng: trip.destinationLng,
        timezone: trip.destinationTimezone,
      },

      dates: {
        departureAt: trip.departureAt,
        arrivalAt: trip.arrivalAt,
        returnDepartureAt: trip.returnDepartureAt,
        returnArrivalAt: trip.returnArrivalAt,
        departureDateLocal: trip.departureDateLocal,
        arrivalDateLocal: trip.arrivalDateLocal,
        departureTimeLocal: trip.departureTimeLocal,
        arrivalTimeLocal: trip.arrivalTimeLocal,
      },

      flightType: trip.flightType,
      trainTripType: trip.trainTripType,
      carTripFlexibility: trip.carTripFlexibility,
      flightLayoverCities: trip.flightLayoverCities,
      trainStopCities: trip.trainStopCities,
      travelReference: trip.travelReference,

      acceptedCategories: trip.acceptedCategories,
      categoryConditions: trip.categoryConditions,
      handDeliveryOnly: trip.handDeliveryOnly,
      instantBooking: trip.instantBooking,
      currencyCode: trip.currencyCode,
      notes: trip.notes,

      maxSlots: trip.maxSlots,
      bookedSlots: trip.bookedSlots,
      remainingSlots:
        trip.maxSlots != null
          ? Math.max(0, trip.maxSlots - trip.bookedSlots)
          : null,

      minPriceCents: trip.minPriceCents,

      ticketVerified: trip.ticketVerificationStatus === "VERIFIED",

      tripper: {
        id: trip.user.id,
        firstName: trip.user.firstName,
        lastInitial: trip.user.lastName
          ? trip.user.lastName.charAt(0).toUpperCase()
          : "",
        avatarUrl: trip.user.avatar?.url ?? null,
        memberSince: trip.user.createdAt,
        carrier: carrierPage
          ? {
            id: carrierPage.id,
            name: carrierPage.name,
            bio: carrierPage.bio,
            isVerified: carrierPage.isVerified,
            isSuperCarrier: carrierPage.isSuperCarrier,
            ratingsAvg: carrierPage.ratingsAvg,
            ratingsCount: carrierPage.ratingsCount,
            totalTripsPublished: carrierPage.totalTripsPublished,
            totalParcelsCarried: carrierPage.totalParcelsCarried,
          }
          : null,
      },

      publishedAt: trip.publishedAt,
    };

    res.status(200).json({ success: true, trip: publicDto });
  } catch (error) {
    next(error);
  }
};
