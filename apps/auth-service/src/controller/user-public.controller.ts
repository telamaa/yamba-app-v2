import type { Response, NextFunction, RequestHandler } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ReviewKind } from "@prisma/client";

// ───────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────

const PREVIEW_TRIPS_LIMIT = 3;
const PREVIEW_REVIEWS_LIMIT = 3;
const TOP_ROUTES_LIMIT = 3;
const PAGINATION_DEFAULT_LIMIT = 10;
const PAGINATION_MAX_LIMIT = 50;

// ───────────────────────────────────────────────────────
// Types DTO
// ───────────────────────────────────────────────────────

type TripPreviewDto = {
  id: string;
  transportMode: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureAt: Date | null;
  flightType: string | null;
  trainTripType: string | null;
  carTripFlexibility: string | null;
  minPriceCents: number | null;
  currencyCode: string;
};

type ReviewPreviewDto = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  author: {
    firstName: string;
    lastInitial: string;
    avatarUrl: string | null;
  };
};

type TopRouteDto = {
  originCity: string;
  destinationCity: string;
  count: number;
};

// ───────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────

function getLastInitial(lastName: string | null | undefined): string {
  if (!lastName) return "";
  return lastName.charAt(0).toUpperCase();
}

function isCarrierActive(user: { carrierStatus: string }): boolean {
  return user.carrierStatus === "ACTIVE";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseLimit(raw: unknown): number {
  const parsed = parseInt(String(raw ?? ""), 10);
  if (Number.isNaN(parsed)) return PAGINATION_DEFAULT_LIMIT;
  return clamp(parsed, 1, PAGINATION_MAX_LIMIT);
}

/**
 * Calcule les top routes depuis une liste de trips.
 * Group by (originCity, destinationCity), count desc, limit 3.
 *
 * On le fait en mémoire JS plutôt qu'avec un aggregate Mongo car :
 *   1. Le volume par user est faible (< 100 trips typiquement)
 *   2. C'est plus simple à maintenir
 *   3. Si la perf devient critique, on dénormalisera sur CarrierPage
 */
function calculateTopRoutes(
  trips: Array<{ originCity: string | null; destinationCity: string | null }>
): TopRouteDto[] {
  const map = new Map<string, TopRouteDto>();

  for (const trip of trips) {
    if (!trip.originCity || !trip.destinationCity) continue;
    const key = `${trip.originCity}::${trip.destinationCity}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, {
        originCity: trip.originCity,
        destinationCity: trip.destinationCity,
        count: 1,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ROUTES_LIMIT);
}

function toTripPreview(t: {
  id: string;
  transportMode: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureAt: Date | null;
  flightType: string | null;
  trainTripType: string | null;
  carTripFlexibility: string | null;
  minPriceCents: number | null;
  currencyCode: string;
}): TripPreviewDto {
  return {
    id: t.id,
    transportMode: t.transportMode,
    originCity: t.originCity,
    destinationCity: t.destinationCity,
    departureAt: t.departureAt,
    flightType: t.flightType,
    trainTripType: t.trainTripType,
    carTripFlexibility: t.carTripFlexibility,
    minPriceCents: t.minPriceCents,
    currencyCode: t.currencyCode,
  };
}

function toReviewPreview(r: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorUser: {
    firstName: string;
    lastName: string | null;
    avatar: { url: string } | null;
  };
}): ReviewPreviewDto {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    author: {
      firstName: r.authorUser.firstName,
      lastInitial: getLastInitial(r.authorUser.lastName),
      avatarUrl: r.authorUser.avatar?.url ?? null,
    },
  };
}

// ───────────────────────────────────────────────────────
// GET /users/:slug/public
// DTO complet avec previews. Auth optionnelle.
// ───────────────────────────────────────────────────────

export const getUserPublic: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next
) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
      next(new ValidationError("Invalid slug."));
      return;
    }

    const currentUserId: string | null = req.user?.id ?? null;

    // Fetch user principal avec relations
    const user = await prisma.user.findUnique({
      where: { publicSlug: slug },
      include: {
        avatar: { select: { url: true } },
        carrierPage: {
          include: {
            primaryAddress: {
              select: {
                city: true,
                country: true,
                countryCode: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.isDeleted) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const isOwnProfile = currentUserId === user.id;
    const isCarrier = isCarrierActive(user);

    // ─── Toutes les data en parallèle pour optimiser ─────
    const [
      tripsForRoutes,
      availableTripsPreview,
      availableTripsCount,
      carrierReviewsPreview,
      carrierReviewsCount,
      shipperReviewsPreview,
      shipperReviewsCount,
      followersCount,
      followingCount,
      myFollow,
    ] = await Promise.all([
      // Trips pour topRoutes — tous statuts qui comptent comme activité
      isCarrier
        ? prisma.trip.findMany({
          where: {
            userId: user.id,
            status: { in: ["PUBLISHED", "COMPLETED", "PAUSED", "ARCHIVED"] },
          },
          select: {
            originCity: true,
            destinationCity: true,
          },
        })
        : Promise.resolve([]),

      // Available trips preview (futur uniquement)
      isCarrier
        ? prisma.trip.findMany({
          where: {
            userId: user.id,
            status: "PUBLISHED",
            departureAt: { gt: new Date() },
          },
          orderBy: { departureAt: "asc" },
          take: PREVIEW_TRIPS_LIMIT,
          select: {
            id: true,
            transportMode: true,
            originCity: true,
            destinationCity: true,
            departureAt: true,
            flightType: true,
            trainTripType: true,
            carTripFlexibility: true,
            minPriceCents: true,
            currencyCode: true,
          },
        })
        : Promise.resolve([]),

      isCarrier
        ? prisma.trip.count({
          where: {
            userId: user.id,
            status: "PUBLISHED",
            departureAt: { gt: new Date() },
          },
        })
        : Promise.resolve(0),

      // Reviews carrier preview
      prisma.review.findMany({
        where: {
          subjectUserId: user.id,
          kind: ReviewKind.AS_CARRIER,
        },
        orderBy: { createdAt: "desc" },
        take: PREVIEW_REVIEWS_LIMIT,
        include: {
          authorUser: {
            select: {
              firstName: true,
              lastName: true,
              avatar: { select: { url: true } },
            },
          },
        },
      }),

      prisma.review.count({
        where: {
          subjectUserId: user.id,
          kind: ReviewKind.AS_CARRIER,
        },
      }),

      // Reviews shipper preview
      prisma.review.findMany({
        where: {
          subjectUserId: user.id,
          kind: ReviewKind.AS_SHIPPER,
        },
        orderBy: { createdAt: "desc" },
        take: PREVIEW_REVIEWS_LIMIT,
        include: {
          authorUser: {
            select: {
              firstName: true,
              lastName: true,
              avatar: { select: { url: true } },
            },
          },
        },
      }),

      prisma.review.count({
        where: {
          subjectUserId: user.id,
          kind: ReviewKind.AS_SHIPPER,
        },
      }),

      // Follow stats
      prisma.userFollow.count({ where: { followedId: user.id } }),
      prisma.userFollow.count({ where: { followerId: user.id } }),

      // Current user's follow row (si connecté ET pas son propre profil)
      currentUserId && currentUserId !== user.id
        ? prisma.userFollow.findUnique({
          where: {
            followerId_followedId: {
              followerId: currentUserId,
              followedId: user.id,
            },
          },
          select: { notifyNextTrip: true },
        })
        : Promise.resolve(null),
    ]);

    // ─── Build DTO ──────────────────────────────────────
    const carrierPage = user.carrierPage;
    const primaryAddress = carrierPage?.primaryAddress;

    const dto = {
      publicSlug: user.publicSlug ?? "",
      firstName: user.firstName,
      lastInitial: getLastInitial(user.lastName),
      avatarUrl: user.avatar?.url ?? null,
      memberSince: user.createdAt,

      location: {
        city: primaryAddress?.city ?? null,
        country: primaryAddress?.country ?? null,
        countryCode: primaryAddress?.countryCode ?? null,
      },

      stats: {
        tripsPublishedCount: carrierPage?.totalTripsPublished ?? 0,
        parcelsCarriedCount: carrierPage?.totalParcelsCarried ?? 0,
        parcelsSentCount: user.parcelsSentCount,
      },

      tripperRating:
        isCarrier && carrierPage
          ? {
            average: carrierPage.ratingsAvg,
            count: carrierPage.ratingsCount,
          }
          : null,

      shipperRating: {
        average: user.shipperRatingsAvg,
        count: user.shipperRatingsCount,
      },

      tripper:
        isCarrier && carrierPage
          ? {
            bio: carrierPage.bio,
            badges: {
              isVerified: carrierPage.isVerified,
              isSuperCarrier: carrierPage.isSuperCarrier,
            },
            topRoutes: calculateTopRoutes(tripsForRoutes),
            availableTripsPreview: availableTripsPreview.map(toTripPreview),
            availableTripsCount,
            reviewsPreview: carrierReviewsPreview.map(toReviewPreview),
            reviewsCount: carrierReviewsCount,
          }
          : null,

      shipper: {
        reviewsPreview: shipperReviewsPreview.map(toReviewPreview),
        reviewsCount: shipperReviewsCount,
      },

      follow: {
        followersCount,
        followingCount,
        // null si non connecté → permet au front de différencier "non connecté"
        // de "connecté mais ne suit pas"
        isFollowedByMe: currentUserId ? myFollow !== null : null,
        notifyNextTrip: myFollow?.notifyNextTrip ?? null,
      },

      isOwnProfile,
    };

    res.status(200).json({ success: true, user: dto });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────
// GET /users/:slug/public/reviews
// Pagination des reviews (?kind=AS_CARRIER|AS_SHIPPER&limit&cursor)
// ───────────────────────────────────────────────────────

export const listUserPublicReviews: RequestHandler = async (req, res, next) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string") {
      next(new ValidationError("Invalid slug."));
      return;
    }

    const kindParam = String(req.query.kind ?? "").toUpperCase();
    const kind: ReviewKind =
      kindParam === "AS_SHIPPER" ? ReviewKind.AS_SHIPPER : ReviewKind.AS_CARRIER;

    const limit = parseLimit(req.query.limit);
    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.length > 0
        ? req.query.cursor
        : undefined;

    const user = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true, isDeleted: true },
    });

    if (!user || user.isDeleted) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    // Cursor pagination : take limit+1 pour détecter la page suivante
    const items = await prisma.review.findMany({
      where: {
        subjectUserId: user.id,
        kind,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        authorUser: {
          select: {
            firstName: true,
            lastName: true,
            avatar: { select: { url: true } },
          },
        },
      },
    });

    const hasNext = items.length > limit;
    const reviews = hasNext ? items.slice(0, limit) : items;
    const nextCursor = hasNext ? reviews[reviews.length - 1].id : null;

    res.status(200).json({
      success: true,
      reviews: reviews.map(toReviewPreview),
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────
// GET /users/:slug/public/trips
// Pagination des trajets disponibles (futur, status=PUBLISHED)
// ───────────────────────────────────────────────────────

export const listUserPublicTrips: RequestHandler = async (req, res, next) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string") {
      next(new ValidationError("Invalid slug."));
      return;
    }

    const limit = parseLimit(req.query.limit);
    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.length > 0
        ? req.query.cursor
        : undefined;

    const user = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true, isDeleted: true, carrierStatus: true },
    });

    if (!user || user.isDeleted) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    // User non-tripper : pas de trips à exposer
    if (user.carrierStatus !== "ACTIVE") {
      res.status(200).json({ success: true, trips: [], nextCursor: null });
      return;
    }

    const items = await prisma.trip.findMany({
      where: {
        userId: user.id,
        status: "PUBLISHED",
        departureAt: { gt: new Date() },
      },
      orderBy: { departureAt: "asc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      select: {
        id: true,
        transportMode: true,
        originCity: true,
        destinationCity: true,
        departureAt: true,
        flightType: true,
        trainTripType: true,
        carTripFlexibility: true,
        minPriceCents: true,
        currencyCode: true,
      },
    });

    const hasNext = items.length > limit;
    const trips = hasNext ? items.slice(0, limit) : items;
    const nextCursor = hasNext ? trips[trips.length - 1].id : null;

    res.status(200).json({
      success: true,
      trips: trips.map(toTripPreview),
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────
// POST /users/:slug/follow
// Suivre un user. Idempotent (re-follow met à jour notifyNextTrip).
// ───────────────────────────────────────────────────────

export const followUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { slug } = req.params;
    const followerId = req.user.id;

    const { notifyNextTrip = true } = req.body as { notifyNextTrip?: boolean };

    const followed = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true, isDeleted: true },
    });

    if (!followed || followed.isDeleted) {
      return next(new ValidationError("User not found."));
    }

    if (followed.id === followerId) {
      return next(new ValidationError("You cannot follow yourself."));
    }

    // Upsert pour idempotence : POST follow déjà existant met juste à jour
    // notifyNextTrip plutôt que d'erreur
    const follow = await prisma.userFollow.upsert({
      where: {
        followerId_followedId: {
          followerId,
          followedId: followed.id,
        },
      },
      update: { notifyNextTrip: Boolean(notifyNextTrip) },
      create: {
        followerId,
        followedId: followed.id,
        notifyNextTrip: Boolean(notifyNextTrip),
      },
    });

    return res.status(200).json({
      success: true,
      message: "User followed.",
      follow: {
        notifyNextTrip: follow.notifyNextTrip,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// DELETE /users/:slug/follow
// Idempotent : pas d'erreur si le follow n'existait pas.
// ───────────────────────────────────────────────────────

export const unfollowUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { slug } = req.params;
    const followerId = req.user.id;

    const followed = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });

    if (!followed) {
      return next(new ValidationError("User not found."));
    }

    // deleteMany ne throw pas si aucun match → idempotent
    await prisma.userFollow.deleteMany({
      where: {
        followerId,
        followedId: followed.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User unfollowed.",
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// PATCH /users/:slug/follow
// Toggle des préférences de notification (notifyNextTrip).
// ───────────────────────────────────────────────────────

export const updateFollowPreferences = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new ValidationError("Unauthorized"));

    const { slug } = req.params;
    const followerId = req.user.id;

    const { notifyNextTrip } = req.body as { notifyNextTrip?: boolean };

    if (typeof notifyNextTrip !== "boolean") {
      return next(new ValidationError("notifyNextTrip (boolean) is required."));
    }

    const followed = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });

    if (!followed) {
      return next(new ValidationError("User not found."));
    }

    const existing = await prisma.userFollow.findUnique({
      where: {
        followerId_followedId: {
          followerId,
          followedId: followed.id,
        },
      },
    });

    if (!existing) {
      return next(new ValidationError("You must follow this user first."));
    }

    const updated = await prisma.userFollow.update({
      where: {
        followerId_followedId: {
          followerId,
          followedId: followed.id,
        },
      },
      data: { notifyNextTrip },
    });

    return res.status(200).json({
      success: true,
      follow: {
        notifyNextTrip: updated.notifyNextTrip,
      },
    });
  } catch (error) {
    return next(error);
  }
};
