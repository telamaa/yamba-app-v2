import type { Response, NextFunction } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import imagekit from "../lib/imagekit";

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
      originRegion,
      originCountry,
      originLat,
      originLng,
      destinationLabel,
      destinationPlaceId,
      destinationCity,
      destinationRegion,
      destinationCountry,
      destinationLat,
      destinationLng,
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
      notes,
      // Publication
      publish,
    } = req.body;

    // Validation minimale
    if (!transportMode) {
      return next(new ValidationError("Transport mode is required."));
    }
    if (!originCity || !destinationCity) {
      return next(new ValidationError("Origin and destination are required."));
    }

    // Vérifier que la date de départ est dans le futur
    if (departureAt && new Date(departureAt) < new Date()) {
      return next(new ValidationError("Departure date must be in the future."));
    }

    // Récupérer le carrierPage si l'utilisateur est carrier
    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: {
        id: true,
        onboardingStep: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
      },
    });

    const shouldPublish = publish === true;

    // Gate: onboarding + Stripe required to publish
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
        originRegion: originRegion?.trim() ?? null,
        originCountry: originCountry?.trim() ?? null,
        originLat: originLat ?? null,
        originLng: originLng ?? null,
        destinationLabel: destinationLabel?.trim() ?? null,
        destinationPlaceId: destinationPlaceId ?? null,
        destinationCity: destinationCity?.trim() ?? null,
        destinationRegion: destinationRegion?.trim() ?? null,
        destinationCountry: destinationCountry?.trim() ?? null,
        destinationLat: destinationLat ?? null,
        destinationLng: destinationLng ?? null,
        // Dates
        departureDateLocal: departureDateLocal ?? null,
        arrivalDateLocal: arrivalDateLocal ?? null,
        departureTimeLocal: departureTimeLocal ?? null,
        arrivalTimeLocal: arrivalTimeLocal ?? null,
        departureAt: departureAt ? new Date(departureAt) : null,
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
        notes: notes?.trim() ?? null,
        // Publication
        publishedAt: shouldPublish ? new Date() : null,
      },
      include: {
        documents: true,
      },
    });

    // Mettre à jour les stats carrier si publié
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

    // Extraire publish du body, le reste = champs à mettre à jour
    const { publish, ...updateData } = req.body;

    // Convertir les dates si présentes
    if (updateData.departureAt) updateData.departureAt = new Date(updateData.departureAt);
    if (updateData.arrivalAt) updateData.arrivalAt = new Date(updateData.arrivalAt);
    if (updateData.returnDepartureAt) updateData.returnDepartureAt = new Date(updateData.returnDepartureAt);
    if (updateData.returnArrivalAt) updateData.returnArrivalAt = new Date(updateData.returnArrivalAt);

    // Si on publie pour la première fois
    if (publish === true && trip.status === "DRAFT") {
      // Gate: onboarding + Stripe required to publish
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: {
          id: true,
          onboardingStep: true,
          stripeOnboardingComplete: true,
          stripeChargesEnabled: true,
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

      // Incrémenter les stats carrier
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
// Ajouter un ou plusieurs documents à un trip
// (Appelé après upload direct vers ImageKit)
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

    // Déduplication par fileId — évite les doublons en mode édition
    const existingFileIds = new Set(trip.documents.map((d) => d.fileId));
    const newDocuments = documents.filter((d) => !existingFileIds.has(d.fileId));

    if (newDocuments.length === 0) {
      // Rien à ajouter, renvoyer l'état actuel
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

    // Vérifier la limite de documents par trip
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

    // Valider chaque document
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

    // NOTE: Prisma field is `status` (not `verificationStatus`)
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

    // Mettre à jour le statut de vérification du trip si besoin
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
// Supprimer un document d'un trip + fichier ImageKit
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

    // Supprimer le fichier d'ImageKit (best effort)
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

    // Si on supprime le dernier ticket, remettre le statut à NOT_SUBMITTED
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
// Annuler un trip (soft delete)
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

    // Mettre à jour les stats carrier si le trip était publié
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
// Restaurer un trip annulé (toujours en brouillon)
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

    // Vérifier que le trip est encore valide (date de départ pas passée)
    if (trip.departureAt && new Date(trip.departureAt) < new Date()) {
      return next(
        new ValidationError("Cannot restore a trip whose departure date has passed.")
      );
    }

    // Toujours restaurer en brouillon
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
// Récupérer un trip par ID
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
// Récupérer tous les trips de l'utilisateur connecté
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
// Publier un brouillon (avec gate onboarding + Stripe)
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

    // Gate: onboarding + Stripe required to publish
    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: {
        id: true,
        onboardingStep: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
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

    // Validation avant publication
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

    await prisma.trip.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        currentStep: 3,
      },
    });

    // Stats carrier
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
// POST /api/trips/:id/unpublish
// Repasser un trip publié ou en pause en brouillon
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

    // Décrémenter le compteur carrier seulement si le trip était publié
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
// POST /api/trips/:id/pause
// Mettre en pause un trip publié
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
// POST /api/trips/:id/resume
// Reprendre un trip en pause
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

    // Vérifier que la date de départ n'est pas passée
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
