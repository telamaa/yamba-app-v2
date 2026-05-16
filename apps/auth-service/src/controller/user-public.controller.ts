import type { Response, NextFunction, RequestHandler } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ReviewKind } from "@prisma/client";

// 🚀 Confirme la version chargée
console.log("🚀🚀🚀 user-public.controller.ts LOADED — VERSION DEBUG-V3", new Date().toISOString());

// Helper pour les logs avec timestamp précis
function ts(): string {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

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

    console.log(`[${ts()}] [getUserPublic] 👀 slug=${slug} currentUserId=${currentUserId}`);

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
      isCarrier
        ? prisma.trip.findMany({
          where: {
            userId: user.id,
            status: { in: ["PUBLISHED", "COMPLETED", "PAUSED", "ARCHIVED"] },
          },
          select: { originCity: true, destinationCity: true },
        })
        : Promise.resolve([]),

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

      prisma.review.findMany({
        where: { subjectUserId: user.id, kind: ReviewKind.AS_CARRIER },
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
        where: { subjectUserId: user.id, kind: ReviewKind.AS_CARRIER },
      }),

      prisma.review.findMany({
        where: { subjectUserId: user.id, kind: ReviewKind.AS_SHIPPER },
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
        where: { subjectUserId: user.id, kind: ReviewKind.AS_SHIPPER },
      }),

      prisma.userFollow.count({ where: { followedId: user.id } }),
      prisma.userFollow.count({ where: { followerId: user.id } }),

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

    console.log(`[${ts()}] [getUserPublic] 📊 myFollow=${myFollow ? "EXISTS" : "null"} followersCount=${followersCount}`);

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
          ? { average: carrierPage.ratingsAvg, count: carrierPage.ratingsCount }
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

    const items = await prisma.review.findMany({
      where: { subjectUserId: user.id, kind },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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
// ───────────────────────────────────────────────────────

export const followUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(`\n[${ts()}] [followUser] 🎬 START - slug=${req.params.slug} userId=${req.user?.id}`);
    console.log(`[${ts()}] [followUser] 📍 Referer:`, req.headers.referer);
    console.log(`[${ts()}] [followUser] 📍 User-Agent:`, req.headers["user-agent"]?.slice(0, 60));

    if (!req.user) {
      console.log(`[${ts()}] [followUser] ❌ No req.user`);
      return next(new ValidationError("Unauthorized"));
    }

    const { slug } = req.params;
    const followerId = req.user.id;

    const { notifyNextTrip = true } = req.body as { notifyNextTrip?: boolean };
    console.log(`[${ts()}] [followUser] 📦 body:`, req.body);

    const followed = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true, isDeleted: true },
    });
    console.log(`[${ts()}] [followUser] 👤 followed user:`, followed);

    if (!followed || followed.isDeleted) {
      console.log(`[${ts()}] [followUser] ❌ Followed user not found or deleted`);
      return next(new ValidationError("User not found."));
    }

    if (followed.id === followerId) {
      console.log(`[${ts()}] [followUser] ❌ Cannot follow yourself`);
      return next(new ValidationError("You cannot follow yourself."));
    }

    // Count BEFORE upsert
    const countBefore = await prisma.userFollow.count();
    console.log(`[${ts()}] [followUser] 🔢 BEFORE upsert: count=${countBefore}`);

    console.log(`[${ts()}] [followUser] 🔄 calling upsert followerId=${followerId} followedId=${followed.id}`);

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

    console.log(`[${ts()}] [followUser] ✅ upsert result:`, JSON.stringify(follow));

    // Count AFTER upsert
    const countAfter = await prisma.userFollow.count();
    console.log(`[${ts()}] [followUser] 🔢 AFTER upsert: count=${countAfter}`);

    return res.status(200).json({
      success: true,
      message: "User followed.",
      follow: {
        notifyNextTrip: follow.notifyNextTrip,
      },
    });
  } catch (error) {
    console.error(`[${ts()}] [followUser] 💥 ERROR:`, error);
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// DELETE /users/:slug/follow
// ───────────────────────────────────────────────────────

export const unfollowUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(`\n[${ts()}] [unfollowUser] 🎬 START - slug=${req.params.slug} userId=${req.user?.id}`);
    console.log(`[${ts()}] [unfollowUser] 📍 Referer:`, req.headers.referer);
    console.log(`[${ts()}] [unfollowUser] 📍 User-Agent:`, req.headers["user-agent"]?.slice(0, 60));

    if (!req.user) {
      console.log(`[${ts()}] [unfollowUser] ❌ No req.user`);
      return next(new ValidationError("Unauthorized"));
    }

    const { slug } = req.params;
    const followerId = req.user.id;

    const followed = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });

    if (!followed) {
      console.log(`[${ts()}] [unfollowUser] ❌ Followed user not found`);
      return next(new ValidationError("User not found."));
    }

    // Count BEFORE delete
    const countBefore = await prisma.userFollow.count();
    console.log(`[${ts()}] [unfollowUser] 🔢 BEFORE delete: count=${countBefore}`);

    console.log(`[${ts()}] [unfollowUser] 🔄 calling deleteMany followerId=${followerId} followedId=${followed.id}`);

    const result = await prisma.userFollow.deleteMany({
      where: {
        followerId,
        followedId: followed.id,
      },
    });

    console.log(`[${ts()}] [unfollowUser] 🗑️ deleteMany result:`, JSON.stringify(result));

    // Count AFTER delete
    const countAfter = await prisma.userFollow.count();
    console.log(`[${ts()}] [unfollowUser] 🔢 AFTER delete: count=${countAfter}`);

    return res.status(200).json({
      success: true,
      message: "User unfollowed.",
    });
  } catch (error) {
    console.error(`[${ts()}] [unfollowUser] 💥 ERROR:`, error);
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// PATCH /users/:slug/follow
// ───────────────────────────────────────────────────────

export const updateFollowPreferences = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(`\n[${ts()}] [updateFollowPreferences] 🎬 START - slug=${req.params.slug} userId=${req.user?.id}`);

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

    console.log(`[${ts()}] [updateFollowPreferences] ✅ updated:`, JSON.stringify(updated));

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

// ───────────────────────────────────────────────────────
// GET /me/following
// ───────────────────────────────────────────────────────

type FollowingUserDto = {
  id: string;
  publicSlug: string | null;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  isCarrier: boolean;
  carrierRatingAvg: number | null;
  carrierRatingCount: number;
  totalTripsPublished: number;
  nextUpcomingTrip: {
    id: string;
    originCity: string;
    destinationCity: string;
    departureAt: Date;
  } | null;
};

type FollowingItemDto = {
  user: FollowingUserDto;
  followedAt: Date;
  notifyNextTrip: boolean;
};

export const listMyFollowing: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next
) => {
  try {
    if (!req.user) {
      next(new ValidationError("Unauthorized"));
      return;
    }

    const followerId = req.user.id;

    const follows = await prisma.userFollow.findMany({
      where: { followerId },
      include: {
        followed: {
          include: {
            avatar: { select: { url: true } },
            carrierPage: {
              select: {
                ratingsAvg: true,
                ratingsCount: true,
                totalTripsPublished: true,
              },
            },
            trips: {
              where: {
                status: "PUBLISHED",
                departureAt: { gt: new Date() },
              },
              orderBy: { departureAt: "asc" },
              take: 1,
              select: {
                id: true,
                originCity: true,
                destinationCity: true,
                departureAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const validFollows = follows.filter((f) => !f.followed.isDeleted);

    const items: FollowingItemDto[] = validFollows.map((f) => {
      const u = f.followed;
      const isCarrier = isCarrierActive(u);
      const tripCandidate = u.trips[0];

      const nextUpcomingTrip =
        tripCandidate &&
        tripCandidate.originCity &&
        tripCandidate.destinationCity &&
        tripCandidate.departureAt
          ? {
            id: tripCandidate.id,
            originCity: tripCandidate.originCity,
            destinationCity: tripCandidate.destinationCity,
            departureAt: tripCandidate.departureAt,
          }
          : null;

      return {
        user: {
          id: u.id,
          publicSlug: u.publicSlug,
          firstName: u.firstName,
          lastInitial: getLastInitial(u.lastName),
          avatarUrl: u.avatar?.url ?? null,
          isCarrier,
          carrierRatingAvg: u.carrierPage?.ratingsAvg ?? null,
          carrierRatingCount: u.carrierPage?.ratingsCount ?? 0,
          totalTripsPublished: u.carrierPage?.totalTripsPublished ?? 0,
          nextUpcomingTrip,
        },
        followedAt: f.createdAt,
        notifyNextTrip: f.notifyNextTrip,
      };
    });

    items.sort((a, b) => {
      const aHasTrip = a.user.nextUpcomingTrip !== null;
      const bHasTrip = b.user.nextUpcomingTrip !== null;
      if (aHasTrip !== bHasTrip) return aHasTrip ? -1 : 1;
      if (aHasTrip && bHasTrip) {
        return (
          new Date(a.user.nextUpcomingTrip!.departureAt).getTime() -
          new Date(b.user.nextUpcomingTrip!.departureAt).getTime()
        );
      }
      return new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime();
    });

    res.status(200).json({
      success: true,
      count: items.length,
      following: items,
    });
  } catch (error) {
    next(error);
  }
};
