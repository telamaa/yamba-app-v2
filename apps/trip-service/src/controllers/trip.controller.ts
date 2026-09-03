import type { Response, NextFunction, RequestHandler } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { favoriteTripIds } from "../services/trip-favorite.service";
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
// ⭐ Lot 2 — State machine : source de vérité des transitions
import {
  canPerform,
  getAllowedActions,
  getCarrierStatDeltas,
  type TripStatus,
} from "../services/trip-state-machine";
import { hasActiveBookings } from "../services/booking-queries";
// ⭐ A28 — gate de publication bi-moteur (D13/D14)
import {
  resolvePricingEngine,
  PRICING_GATE_MESSAGE,
  checkBagCapacity,
  pickPerKgFields,
} from "../services/pricing-gate";
import { chunkUpdateData } from "../lib/mongo-update-chunks";
import { computeComparablePriceCents } from "../lib/comparable-price";

// ─────────────────────────────────────────────
// Helper interne : recalcule les champs dénormalisés
// ─────────────────────────────────────────────

function computeDenormalizedFields(input: {
  categoryConditions?: Array<{ priceAmountCents: number }>;
  pricePerKgCents?: number | null;
  departureAt?: Date | null;
  originTimezone?: string | null;
}): { minPriceCents: number | null; comparablePriceCents: number | null; departureHourLocal: number | null } {
  const minPriceCents = computeMinPriceCents(
    (input.categoryConditions ?? []) as any
  );
  // D33 — prix comparable (colis de référence 2 kg), PER_KG prime
  const comparablePriceCents = computeComparablePriceCents({
    pricePerKgCents: input.pricePerKgCents,
    minPriceCents,
  });
  const departureHourLocal =
    input.departureAt && input.originTimezone
      ? computeHourLocal(input.departureAt, input.originTimezone)
      : input.departureAt
        ? computeHourLocal(input.departureAt, "Europe/Paris")
        : null;
  return { minPriceCents, comparablePriceCents, departureHourLocal };
}

// ─────────────────────────────────────────────
// ⭐ Lot 2 — Helpers lifecycle
// ─────────────────────────────────────────────

/**
 * Charge un trip et vérifie : existence, non-supprimé, ownership.
 * Un trip soft-deleted est traité comme inexistant (même message,
 * pour ne pas révéler son existence).
 */
async function findOwnedTrip(id: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || trip.isDeleted) {
    return { trip: null, error: "Trip not found." } as const;
  }
  if (trip.userId !== userId) {
    return { trip: null, error: "Unauthorized." } as const;
  }
  return { trip, error: null } as const;
}

/**
 * Contexte lifecycle pour la state machine.
 * `hasActiveBookings`
 * // PR3 : requête réelle (booking-queries) — DISPUTED inclus (A20).)
 * n'existe pas — le branchement se fera dans trip-state-machine.ts.
 */
async function buildLifecycleCtx(tripId: string) {
  return { hasActiveBookings: await hasActiveBookings(tripId) };
}

/**
 * Applique les deltas de stats carrier calculés sur la TRANSITION
 * (from → to) — jamais sur le statut courant. Corrige le bug du
 * chemin PAUSED (publish +1 puis pause → cancel qui ne décrémentait pas).
 */
async function applyCarrierStatDeltas(
  userId: string,
  from: TripStatus,
  to: TripStatus | null
) {
  const deltas = getCarrierStatDeltas(from, to);
  if (!deltas) return;

  const carrierPage = await prisma.carrierPage.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!carrierPage) return;

  await prisma.carrierPage.update({
    where: { id: carrierPage.id },
    data: deltas,
  });
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

    // ⭐ D31 — le gate profil/Stripe a MIGRÉ vers l'ACCEPTATION d'un deal
    // (deal-service, B2-PR2) : publier n'exige plus le KYC — on le demande
    // au moment où l'argent est réel. Le carrierPage ne sert plus ici qu'au
    // snapshot de note.
    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: { id: true, ratingsAvg: true, ratingsCount: true },
    });

    if (shouldPublish) {
      // ⭐ A28 — UN moteur de pricing COMPLET est exigé pour publier, sur ce
      // chemin aussi (POST /trips + publish: true) — même vérité que
      // publishTrip et updateTrip.
      if (
        resolvePricingEngine({
          pricePerKgCents: data.pricePerKgCents,
          capacityKg: data.capacityKg,
          categoryConditions: data.categoryConditions as unknown[] | undefined,
        }) === null
      ) {
        return next(new ValidationError(PRICING_GATE_MESSAGE));
      }
      const bagIssue = checkBagCapacity(data);
      if (bagIssue) {
        return next(new ValidationError(bagIssue));
      }
    }

    const { minPriceCents, comparablePriceCents, departureHourLocal } = computeDenormalizedFields({
      categoryConditions: data.categoryConditions,
      pricePerKgCents: data.pricePerKgCents,
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

        // ── Conditions (legacy PER_CATEGORY) ──
        acceptedCategories: data.acceptedCategories ?? [],
        categoryConditions: data.categoryConditions ?? [],

        // ⭐ Moteur PER_KG (D13/D14/D19) — helper pur, testé : ces champs
        // avaient été oubliés ici en PR-B (trip publié à 0 €)
        ...pickPerKgFields(data),

        // ⭐ Lieux de remise / livraison
        pickupLocations: data.pickupLocations ?? [],
        deliveryLocations: data.deliveryLocations ?? [],

        handDeliveryOnly: data.handDeliveryOnly ?? false,
        instantBooking: data.instantBooking ?? false,
        currencyCode: data.currencyCode ?? "EUR",
        maxSlots: data.maxSlots ?? null,
        notes: data.notes ?? null,

        minPriceCents,
        comparablePriceCents,
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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    // ⭐ Lot 2 — La machine remplace le check ad hoc "CANCELLED".
    // Bloque désormais aussi COMPLETED / ARCHIVED, et (à terme) les
    // trips PUBLISHED/PAUSED avec réservations actives.
    const ctx = await buildLifecycleCtx(trip.id);
    const editCheck = canPerform(trip, "edit", ctx);
    if (!editCheck.allowed) {
      return next(new ValidationError(editCheck.reason));
    }

    // Build update payload: only include fields that were actually sent
    // (Zod has already trimmed strings and uppercased ISO codes).
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }

    const willRecomputePrice =
      "categoryConditions" in updateData || "pricePerKgCents" in updateData;
    const willRecomputeHour = "departureAt" in updateData || "originTimezone" in updateData;

    if (willRecomputePrice || willRecomputeHour) {
      const recomputed = computeDenormalizedFields({
        categoryConditions: updateData.categoryConditions ?? (trip.categoryConditions as any),
        pricePerKgCents: updateData.pricePerKgCents ?? trip.pricePerKgCents,
        departureAt: updateData.departureAt ?? trip.departureAt,
        originTimezone: updateData.originTimezone ?? trip.originTimezone,
      });
      if (willRecomputePrice) {
        updateData.minPriceCents = recomputed.minPriceCents;
        updateData.comparablePriceCents = recomputed.comparablePriceCents;
      }
      if (willRecomputeHour) updateData.departureHourLocal = recomputed.departureHourLocal;
    }

    if (publish === true && trip.status === "DRAFT") {
      // ⭐ Lot 2 — Guard machine (statut + date de départ non passée)
      const publishCheck = canPerform(trip, "publish", ctx);
      if (!publishCheck.allowed) {
        return next(new ValidationError(publishCheck.reason));
      }

      // ⭐ D31 — plus de gate profil/Stripe à la publication (déplacé vers
      // l'acceptation, deal-service B2-PR2) ; seul le snapshot de note reste.
      const carrierPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: { ratingsAvg: true, ratingsCount: true },
      });

      // Locations gate: at least 1 pickup + 1 delivery
      const effectivePickup = updateData.pickupLocations ?? trip.pickupLocations ?? [];
      const effectiveDelivery = updateData.deliveryLocations ?? trip.deliveryLocations ?? [];
      if (effectivePickup.length === 0) {
        return next(new ValidationError("At least one pickup location is required to publish."));
      }
      if (effectiveDelivery.length === 0) {
        return next(new ValidationError("At least one delivery location is required to publish."));
      }

      // ⭐ A28 — gate bi-moteur sur les valeurs EFFECTIVES (payload ?? trip).
      if (
        resolvePricingEngine({
          pricePerKgCents: updateData.pricePerKgCents ?? trip.pricePerKgCents,
          capacityKg: updateData.capacityKg ?? trip.capacityKg,
          categoryConditions: (updateData.categoryConditions ??
            trip.categoryConditions) as unknown[],
        }) === null
      ) {
        return next(new ValidationError(PRICING_GATE_MESSAGE));
      }
      const bagIssue = checkBagCapacity({
        capacityKg: updateData.capacityKg ?? trip.capacityKg,
        checkedBag23PriceCents: updateData.checkedBag23PriceCents ?? trip.checkedBag23PriceCents,
        cabinBag12PriceCents: updateData.cabinBag12PriceCents ?? trip.cabinBag12PriceCents,
      });
      if (bagIssue) {
        return next(new ValidationError(bagIssue));
      }

      updateData.status = "PUBLISHED";
      updateData.publishedAt = new Date();
      updateData.currentStep = 3;
      updateData.carrierRatingSnapshot =
        carrierPage && carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

      // ⭐ Lot 2 — Deltas sur la transition DRAFT → PUBLISHED
      await applyCarrierStatDeltas(userId, trip.status, "PUBLISHED");
    }

    // ⭐ Atlas (tiers partagés) : « Pipeline length greater than 50 » — Prisma
    // émet une étape $set par champ quand des types composites sont présents.
    // On écrit par paquets ; la transition d'état part dans le dernier.
    const chunks = chunkUpdateData(updateData);
    let updated = trip as typeof trip & { documents: unknown[] };
    for (let i = 0; i < chunks.length; i++) {
      updated = (await prisma.trip.update({
        where: { id },
        data: chunks[i],
        include: { documents: true },
      })) as typeof updated;
    }

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

    // ⭐ Lot 2 — soft-deleted = introuvable
    if (!trip || trip.isDeleted) return next(new ValidationError("Trip not found."));
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
    // ⭐ Lot 2 — soft-deleted = introuvable
    if (!trip || trip.isDeleted) return next(new ValidationError("Trip not found."));
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
// ⭐ Lot 2 — Internes : cancel et soft delete
// ─────────────────────────────────────────────

async function performCancel(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return next(new ValidationError("Unauthorized"));

  const { id } = req.params;
  const userId = req.user.id;

  const { trip, error } = await findOwnedTrip(id, userId);
  if (!trip) return next(new ValidationError(error));

  const ctx = await buildLifecycleCtx(trip.id);
  const check = canPerform(trip, "cancel", ctx);
  if (!check.allowed) return next(new ValidationError(check.reason));

  // NOTE chantier Booking : si hasActiveBookings, déclencher ici les
  // side-effects (remboursements Stripe, notifications expéditeurs).

  await prisma.trip.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  // ⭐ Deltas sur la transition (corrige le chemin PAUSED → cancel)
  await applyCarrierStatDeltas(userId, trip.status as TripStatus, "CANCELLED");

  return res.status(200).json({ success: true, message: "Trip cancelled." });
}

async function performSoftDelete(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return next(new ValidationError("Unauthorized"));

  const { id } = req.params;
  const userId = req.user.id;

  const { trip, error } = await findOwnedTrip(id, userId);
  if (!trip) return next(new ValidationError(error));

  const ctx = await buildLifecycleCtx(trip.id);
  const check = canPerform(trip, "delete", ctx);
  if (!check.allowed) return next(new ValidationError(check.reason));

  // ⭐ Soft delete — le statut reste DRAFT, le trip sort de toutes
  // les listes via le filtre isDeleted. Plus de hard delete : les
  // documents et références (messages, liens) restent cohérents.
  await prisma.trip.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return res.status(200).json({ success: true, message: "Draft deleted." });
}

// ─────────────────────────────────────────────
// DELETE /api/trips/:id
// ⭐ Lot 2 — Dispatch : ?hard=true → soft delete (brouillons),
// sinon alias backward-compat de cancel (comme resolveSectionKey).
// AVANT : ?hard était ignoré et "Supprimer le brouillon" produisait
// en réalité un trajet CANCELLED visible dans l'Historique.
// ─────────────────────────────────────────────

export const deleteTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.query.hard === "true") {
      return await performSoftDelete(req, res, next);
    }
    return await performCancel(req, res, next);
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/cancel
// ⭐ Lot 2 — Endpoint explicite (le DELETE reste en alias)
// ─────────────────────────────────────────────

export const cancelTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return await performCancel(req, res, next);
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/archive
// ⭐ Lot 2 — NOUVEAU. One-way (pas de désarchivage MVP).
// Remplace le toast fake côté front.
// ─────────────────────────────────────────────

export const archiveTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { id } = req.params;
    const userId = req.user.id;

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "archive", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

    await prisma.trip.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    // COMPLETED/CANCELLED → ARCHIVED : hors pool public, aucun delta.

    return res.status(200).json({ success: true, message: "Trip archived." });
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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    // ⭐ Lot 2 — Machine : CANCELLED → DRAFT, date non passée
    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "restore", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

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
// ⭐ Lot 2 — FIX SÉCURITÉ : ownership check (avant, n'importe quel
// utilisateur authentifié pouvait lire le DTO privé d'autrui).
// La route publique filtrée reste GET /trips/:id/public.
// ─────────────────────────────────────────────

export const getTrip = async (
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

    if (!trip || trip.isDeleted) return next(new ValidationError("Trip not found."));
    if (trip.userId !== userId) return next(new ValidationError("Unauthorized."));

    // ⭐ Lot 2 — Le front affichera exactement ce que l'API autorise
    const ctx = await buildLifecycleCtx(trip.id);
    const allowedActions = getAllowedActions(trip, ctx);

    return res.status(200).json({ success: true, trip: { ...trip, allowedActions } });
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

    // ⭐ Lot 2 — les trips soft-deleted n'apparaissent plus jamais
    const where: any = { userId, isDeleted: false };
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

    // ⭐ Lot 2 — allowedActions par trip (stub booking → coût nul ;
    // au chantier Booking, remplacer par un count groupé par tripId).
    const withActions = await Promise.all(
      trips.map(async (t) => ({
        ...t,
        allowedActions: getAllowedActions(t, await buildLifecycleCtx(t.id)),
      }))
    );

    return res.status(200).json({ success: true, trips: withActions, count: withActions.length });
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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    // ⭐ Lot 2 — Machine : DRAFT uniquement + date de départ future
    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "publish", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

    // ⭐ D31 — plus de gate profil/Stripe à la publication (déplacé vers
    // l'acceptation, deal-service B2-PR2) ; seul le snapshot de note reste.
    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      select: { ratingsAvg: true, ratingsCount: true },
    });

    if (!trip.transportMode) {
      return next(new ValidationError("Transport mode is required to publish."));
    }
    if (!trip.originCity || !trip.destinationCity) {
      return next(new ValidationError("Origin and destination are required to publish."));
    }
    if (!trip.departureAt) {
      return next(new ValidationError("Departure date is required to publish."));
    }
    // ⭐ A28 — UN moteur de pricing COMPLET est exige pour publier.
    const pricingEngine = resolvePricingEngine({
      pricePerKgCents: trip.pricePerKgCents,
      capacityKg: trip.capacityKg,
      categoryConditions: trip.categoryConditions as unknown[],
    });
    if (pricingEngine === null) {
      return next(new ValidationError(PRICING_GATE_MESSAGE));
    }
    const bagIssue = checkBagCapacity(trip);
    if (bagIssue) {
      return next(new ValidationError(bagIssue));
    }
    // Les categories n'existent que pour le moteur legacy (la famille D14 les remplace)
    if (
      pricingEngine === "PER_CATEGORY" &&
      (!trip.acceptedCategories || trip.acceptedCategories.length === 0)
    ) {
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
      carrierPage && carrierPage.ratingsCount > 0 ? carrierPage.ratingsAvg : null;

    const publishedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        currentStep: 3,
        carrierRatingSnapshot,
      },
    });

    // ⭐ Lot 2 — Deltas sur la transition
    await applyCarrierStatDeltas(userId, trip.status as TripStatus, "PUBLISHED");

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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    // ⭐ Lot 2 — Machine : PUBLISHED/PAUSED → DRAFT, interdit avec
    // réservations actives (guard prêt pour le chantier Booking).
    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "unpublish", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

    await prisma.trip.update({
      where: { id },
      data: { status: "DRAFT", publishedAt: null, currentStep: 1 },
    });

    // ⭐ Deltas : décrémente aussi depuis PAUSED (corrige le bug stats)
    await applyCarrierStatDeltas(userId, trip.status as TripStatus, "DRAFT");

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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "pause", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

    await prisma.trip.update({
      where: { id },
      data: { status: "PAUSED" },
    });

    // PUBLISHED → PAUSED : reste dans le pool public, aucun delta.

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

    const { trip, error } = await findOwnedTrip(id, userId);
    if (!trip) return next(new ValidationError(error));

    // ⭐ Lot 2 — Machine : PAUSED → PUBLISHED, date non passée
    const ctx = await buildLifecycleCtx(trip.id);
    const check = canPerform(trip, "resume", ctx);
    if (!check.allowed) return next(new ValidationError(check.reason));

    await prisma.trip.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });

    // PAUSED → PUBLISHED : reste dans le pool public, aucun delta.

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
    // ⭐ Lot 2 — soft-deleted = introuvable (belt & suspenders : un trip
    // supprimé est forcément DRAFT, donc déjà exclu par le check suivant)
    if (trip.isDeleted || trip.status !== "PUBLISHED") {
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

      // ⭐ Moteur PER_KG (D13/D14/D19) — contrat trip-public.schema.ts
      pricePerKgCents: trip.pricePerKgCents,
      capacityKg: trip.capacityKg,
      reservedKg: trip.reservedKg,
      remainingKg:
        trip.capacityKg != null ? Math.max(0, trip.capacityKg - (trip.reservedKg ?? 0)) : null,
      checkedBag23PriceCents: trip.checkedBag23PriceCents,
      cabinBag12PriceCents: trip.cabinBag12PriceCents,
      familyConditions: trip.familyConditions,

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
      // D46 — isOptionallyAuthenticated : connecté → son favori, visiteur → false
      isFavorite: (await favoriteTripIds((req as { user?: { id?: string } }).user?.id, [trip.id])).has(trip.id),
    };

    res.status(200).json({ success: true, trip: publicDto });
  } catch (error) {
    next(error);
  }
};
