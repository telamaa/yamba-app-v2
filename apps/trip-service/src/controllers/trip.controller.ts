import type { Response, NextFunction, RequestHandler } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import imagekit from "../lib/imagekit";
import {
  computeMinPriceCents,
  computeHourLocal,
} from "../lib/trip-mappers";
import { triggerTripPublishedNotifications } from "../services/trigger-trip-notifications";
import {
  createTripSchema,
  updateTripSchema,
  formatZodError,
} from "../schemas/trip.schema";

// ─────────────────────────────────────────────
// Helper interne : recalcule les champs dénormalisés
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
        ? computeHourLocal(input.departureAt, "Europe/Paris")
        : null;
  return { minPriceCents, departureHourLocal };
}

// ─────────────────────────────────────────────
// POST /api/trips
// ─────────────────────────────────────────────

export const createTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    // ── Zod validation (shape + intra-payload rules) ──
    const parsed = createTripSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(formatZodError(parsed.error)));
    }
    const data = parsed.data;
    const userId = req.user.id;
    const shouldPublish = data.publish === true;

    // ── DB-dependent publish gate ──
    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: {
        id: true,
        onboardingStep: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        ratingsAvg: true,
        ratingsCount: true,
      },
    });

    if (shouldPublish) {
      if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
        return next(new ValidationError("Carrier profile must be completed to publish a trip."));
      }
      if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
        return next(new ValidationError("Stripe must be configured to publish a trip."));
      }
    }

    const { minPriceCents, departureHourLocal } = computeDenormalizedFields({
      categoryConditions: data.categoryConditions,
      departureAt: data.departureAt ?? null,
      originTimezone: data.originTimezone ?? null,
    });

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
        transportMode: data.transportMode,
        tripType: data.tripType ?? "ONE_WAY",

        // ── Origin (Zod already trimmed + ISO uppercased) ──
        originLabel: data.originLabel ?? null,
        originPlaceId: data.originPlaceId ?? null,
        originCity: data.originCity,
        originCityCode: data.originCityCode ?? null,
        originRegion: data.originRegion ?? null,
        originRegionCode: data.originRegionCode ?? null,
        originCountry: data.originCountry ?? null,
        originCountryCode: data.originCountryCode ?? null,
        originLat: data.originLat ?? null,
        originLng: data.originLng ?? null,
        originTimezone: data.originTimezone ?? null,

        // ── Destination ──
        destinationLabel: data.destinationLabel ?? null,
        destinationPlaceId: data.destinationPlaceId ?? null,
        destinationCity: data.destinationCity,
        destinationCityCode: data.destinationCityCode ?? null,
        destinationRegion: data.destinationRegion ?? null,
        destinationRegionCode: data.destinationRegionCode ?? null,
        destinationCountry: data.destinationCountry ?? null,
        destinationCountryCode: data.destinationCountryCode ?? null,
        destinationLat: data.destinationLat ?? null,
        destinationLng: data.destinationLng ?? null,
        destinationTimezone: data.destinationTimezone ?? null,

        // ── Dates ──
        departureDateLocal: data.departureDateLocal ?? null,
        arrivalDateLocal: data.arrivalDateLocal ?? null,
        departureTimeLocal: data.departureTimeLocal ?? null,
        arrivalTimeLocal: data.arrivalTimeLocal ?? null,
        departureAt: data.departureAt ?? null,
        arrivalAt: data.arrivalAt ?? null,
        returnDepartureAt: data.returnDepartureAt ?? null,
        returnArrivalAt: data.returnArrivalAt ?? null,

        // ── Mode-specific ──
        flightType: data.flightType ?? null,
        trainTripType: data.trainTripType ?? null,
        carTripFlexibility: data.carTripFlexibility ?? null,
        flightLayoverCities: data.flightLayoverCities ?? [],
        trainStopCities: data.trainStopCities ?? [],
        travelReference: data.travelReference ?? null,

        // ── Conditions ──
        acceptedCategories: data.acceptedCategories ?? [],
        categoryConditions: data.categoryConditions ?? [],

        // ⭐ Lieux de remise / livraison
        pickupLocations: data.pickupLocations ?? [],
        deliveryLocations: data.deliveryLocations ?? [],

        handDeliveryOnly: data.handDeliveryOnly ?? false,
        instantBooking: data.instantBooking ?? false,
        currencyCode: data.currencyCode ?? "EUR",
        maxSlots: data.maxSlots ?? null,
        notes: data.notes ?? null,

        minPriceCents,
        departureHourLocal,
        carrierRatingSnapshot,
        publishedAt: shouldPublish ? new Date() : null,
      },
      include: { documents: true },
    });

    if (shouldPublish && carrierPage) {
      await prisma.carrierPage.update({
        where: { id: carrierPage.id },
        data: { totalTripsPublished: { increment: 1 } },
      });
    }

    if (shouldPublish) {
      triggerTripPublishedNotifications(trip);
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

    // ── Zod validation (shape only — DB rules below) ──
    const parsed = updateTripSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(formatZodError(parsed.error)));
    }
    const { publish, ...data } = parsed.data;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));
    if (trip.status === "CANCELLED") {
      return next(new ValidationError("Cannot edit a cancelled trip."));
    }

    // Build update payload: only include fields that were actually sent
    // (Zod has already trimmed strings and uppercased ISO codes).
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }

    const willRecomputePrice = "categoryConditions" in updateData;
    const willRecomputeHour = "departureAt" in updateData || "originTimezone" in updateData;

    if (willRecomputePrice || willRecomputeHour) {
      const recomputed = computeDenormalizedFields({
        categoryConditions: updateData.categoryConditions ?? (trip.categoryConditions as any),
        departureAt: updateData.departureAt ?? trip.departureAt,
        originTimezone: updateData.originTimezone ?? trip.originTimezone,
      });
      if (willRecomputePrice) updateData.minPriceCents = recomputed.minPriceCents;
      if (willRecomputeHour) updateData.departureHourLocal = recomputed.departureHourLocal;
    }

    if (publish === true && trip.status === "DRAFT") {
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: {
          id: true,
          onboardingStep: true,
          stripeOnboardingComplete: true,
          stripeChargesEnabled: true,
          ratingsAvg: true,
          ratingsCount: true,
        },
      });

      if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
        return next(new ValidationError("Carrier profile must be completed to publish a trip."));
      }
      if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
        return next(new ValidationError("Stripe must be configured to publish a trip."));
      }

      // Locations gate: at least 1 pickup + 1 delivery
      const effectivePickup = updateData.pickupLocations ?? trip.pickupLocations ?? [];
      const effectiveDelivery = updateData.deliveryLocations ?? trip.deliveryLocations ?? [];
      if (effectivePickup.length === 0) {
        return next(new ValidationError("At least one pickup location is required to publish."));
      }
      if (effectiveDelivery.length === 0) {
        return next(new ValidationError("At least one delivery location is required to publish."));
      }

      updateData.status = "PUBLISHED";
      updateData.publishedAt = new Date();
      updateData.currentStep = 3;
      updateData.carrierRatingSnapshot = carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

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

    if (publish === true && trip.status === "DRAFT") {
      triggerTripPublishedNotifications(updated);
    }

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
      return next(new ValidationError(`Maximum ${maxDocs} documents per trip. Currently ${currentCount}.`));
    }

    const maxSizeMb = siteConfig?.maxDocSizeMb ?? 5;
    for (const doc of newDocuments) {
      if (!doc.type || !doc.fileId || !doc.url) {
        return next(new ValidationError("Each document must have type, fileId, and url."));
      }
      if (doc.sizeBytes && doc.sizeBytes > maxSizeMb * 1024 * 1024) {
        return next(new ValidationError(`Document "${doc.originalName}" exceeds ${maxSizeMb}MB limit.`));
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

    const doc = await prisma.tripDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.tripId !== id) {
      return next(new ValidationError("Document not found."));
    }

    if (doc.fileId) {
      try {
        await imagekit.deleteFile(doc.fileId);
      } catch (err: any) {
        console.warn(`[ImageKit] Failed to delete file ${doc.fileId}:`, err?.message);
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

    return res.status(200).json({ success: true, message: "Document removed." });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/trips/:id
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
      data: { status: "CANCELLED", cancelledAt: new Date() },
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

    return res.status(200).json({ success: true, message: "Trip cancelled." });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/restore
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
      return next(new ValidationError("Cannot restore a trip whose departure date has passed."));
    }

    await prisma.trip.update({
      where: { id },
      data: { status: "DRAFT", cancelledAt: null },
    });

    return res.status(200).json({ success: true, message: "Trip restored as draft." });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/trips/:id
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

    return res.status(200).json({ success: true, trip });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/trips/my
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
        documents: { select: { id: true, type: true, status: true, url: true } },
      },
    });

    return res.status(200).json({ success: true, trips, count: trips.length });
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
        ratingsAvg: true,
        ratingsCount: true,
      },
    });

    if (!carrierPage || carrierPage.onboardingStep === "PROFILE") {
      return next(new ValidationError("Carrier profile must be completed to publish a trip."));
    }
    if (!carrierPage.stripeOnboardingComplete || !carrierPage.stripeChargesEnabled) {
      return next(new ValidationError("Stripe must be configured to publish a trip."));
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

    // ⭐ Locations gate
    if (!trip.pickupLocations || trip.pickupLocations.length === 0) {
      return next(new ValidationError("At least one pickup location is required to publish."));
    }
    if (!trip.deliveryLocations || trip.deliveryLocations.length === 0) {
      return next(new ValidationError("At least one delivery location is required to publish."));
    }

    const carrierRatingSnapshot =
      carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

    const publishedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        currentStep: 3,
        carrierRatingSnapshot,
      },
    });

    await prisma.carrierPage.update({
      where: { id: carrierPage.id },
      data: { totalTripsPublished: { increment: 1 } },
    });

    triggerTripPublishedNotifications(publishedTrip);

    return res.status(200).json({ success: true, message: "Trip published!" });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/unpublish
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
      return next(new ValidationError("Only published or paused trips can be reverted to draft."));
    }

    const wasPublished = trip.status === "PUBLISHED";

    await prisma.trip.update({
      where: { id },
      data: { status: "DRAFT", publishedAt: null, currentStep: 1 },
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

    return res.status(200).json({ success: true, message: "Trip reverted to draft." });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/pause
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

    return res.status(200).json({ success: true, message: "Trip paused." });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/resume
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

    return res.status(200).json({ success: true, message: "Trip resumed." });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /trips/:id/public
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
            publicSlug: true,
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
        placeId: trip.originPlaceId,
        city: trip.originCity,
        cityCode: trip.originCityCode,
        region: trip.originRegion,
        regionCode: trip.originRegionCode,
        country: trip.originCountry,
        countryCode: trip.originCountryCode,
        lat: trip.originLat,
        lng: trip.originLng,
        timezone: trip.originTimezone,
      },
      destination: {
        label: trip.destinationLabel,
        placeId: trip.destinationPlaceId,
        city: trip.destinationCity,
        cityCode: trip.destinationCityCode,
        region: trip.destinationRegion,
        regionCode: trip.destinationRegionCode,
        country: trip.destinationCountry,
        countryCode: trip.destinationCountryCode,
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

      // ⭐ Lieux de remise / livraison
      pickupLocations: trip.pickupLocations,
      deliveryLocations: trip.deliveryLocations,

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
        publicSlug: trip.user.publicSlug,
        firstName: trip.user.firstName,
        lastInitial: trip.user.lastName ? trip.user.lastName.charAt(0).toUpperCase() : "",
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
