import { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import {
  ObjectIdSchema,
  MyBookingsQuerySchema,
  TripDealsQuerySchema,
  type BookingViewerRole,
} from "@packages/api-contracts";
import {
  toBookingView,
  toShipperBookingView,
  toCarrierBookingView,
  type BookingRecord,
  type CounterpartRecord,
} from "../services/booking-view.mapper";

/**
 * deal.controller.ts — lecture seule (PR3, périmètre B1)
 * ======================================================
 * Emplacement : apps/deal-service/src/controllers/deal.controller.ts
 *
 * A21 — sémantique d'erreurs PROPRE dès le jour 1 (contrairement au
 * trip-service, dette fix/error-semantics) :
 *   400 ValidationError  → requête malformée uniquement
 *   403 ForbiddenError   → authentifié mais pas partie prenante
 *   404 NotFoundError    → ressource inexistante ou soft-deleted
 *
 * A12 — ownership du trip par lecture Prisma DIRECTE read-only
 * (même base, même monorepo) ; l'écriture reste chez trip-service.
 *
 * Validation Zod (D3) : les MÊMES schémas qui génèrent l'OAS valident
 * les query strings à l'exécution — une seule source de vérité.
 */

/* ══ Jointure contrepartie (Booking sans relations Prisma) ════ */

async function loadCounterparts(
  userIds: string[]
): Promise<Map<string, CounterpartRecord>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: { select: { url: true } },
    },
  });

  return new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        avatarUrl: u.avatar?.url ?? null,
      },
    ])
  );
}

/** Contrepartie de secours si le compte a été purgé (RGPD). */
const GHOST_COUNTERPART = (id: string): CounterpartRecord => ({
  id,
  firstName: null,
  lastName: null,
  avatarUrl: null,
});

/* ══ GET /deals/:id — vue par rôle ════════════════════════════ */

export const getDeal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedId = ObjectIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return next(new ValidationError("Invalid deal id."));
    }

    const booking = (await prisma.booking.findUnique({
      where: { id: parsedId.data },
    })) as BookingRecord | null;

    if (!booking || booking.isDeleted) {
      return next(new NotFoundError("Deal not found."));
    }

    const userId: string = req.user.id;
    let viewerRole: BookingViewerRole;
    if (booking.shipperId === userId) {
      viewerRole = "SHIPPER";
    } else if (booking.carrierId === userId) {
      viewerRole = "CARRIER";
    } else {
      // 403 et non 404 : le deal existe, le lecteur n'y est pas partie.
      return next(new ForbiddenError("You are not a party to this deal."));
    }

    const counterpartId =
      viewerRole === "SHIPPER" ? booking.carrierId : booking.shipperId;
    const counterparts = await loadCounterparts([counterpartId]);
    const counterpart =
      counterparts.get(counterpartId) ?? GHOST_COUNTERPART(counterpartId);

    return res.status(200).json({
      success: true,
      viewerRole,
      deal: toBookingView(booking, viewerRole, counterpart),
    });
  } catch (error) {
    return next(error);
  }
};

/* ══ GET /me/bookings — Mes envois (vue Shipper) ══════════════ */

export const getMyBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedQuery = MyBookingsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return next(new ValidationError("Invalid query: unknown status value."));
    }
    const { status } = parsedQuery.data;

    const bookings = (await prisma.booking.findMany({
      where: {
        shipperId: req.user.id,
        isDeleted: false,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    })) as unknown as BookingRecord[];

    const counterparts = await loadCounterparts(
      bookings.map((b) => b.carrierId)
    );

    const views = bookings.map((b) =>
      toShipperBookingView(
        b,
        counterparts.get(b.carrierId) ?? GHOST_COUNTERPART(b.carrierId)
      )
    );

    return res.status(200).json({
      success: true,
      bookings: views,
      count: views.length,
    });
  } catch (error) {
    return next(error);
  }
};

/* ══ GET /deals?tripId= — deals d'un trip du Carrier (A12) ════ */

export const getTripDeals = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedQuery = TripDealsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return next(
        new ValidationError("Invalid query: tripId (ObjectId) is required.")
      );
    }
    const { tripId, status } = parsedQuery.data;

    // A12 — ownership par lecture Prisma directe, read-only.
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!trip || trip.isDeleted) {
      return next(new NotFoundError("Trip not found."));
    }
    if (trip.userId !== req.user.id) {
      return next(new ForbiddenError("You do not own this trip."));
    }

    const bookings = (await prisma.booking.findMany({
      where: {
        tripId,
        isDeleted: false,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    })) as unknown as BookingRecord[];

    const counterparts = await loadCounterparts(
      bookings.map((b) => b.shipperId)
    );

    const views = bookings.map((b) =>
      toCarrierBookingView(
        b,
        counterparts.get(b.shipperId) ?? GHOST_COUNTERPART(b.shipperId)
      )
    );

    return res.status(200).json({
      success: true,
      deals: views,
      count: views.length,
    });
  } catch (error) {
    return next(error);
  }
};
