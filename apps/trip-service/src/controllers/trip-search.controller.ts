import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import {
  TRIP_SEARCH_INCLUDE,
  mapTripToYambaResult,
  transportModeUiToDb,
  parcelCategoryUiToDb,
  bucketToHourCondition,
  type UiTransportMode,
  type UiParcelCategory,
  type DepartureBucket,
  type YambaTripResultDto,
} from "../lib/trip-mappers";
import {
  searchTripsQuerySchema,
  searchFacetsQuerySchema,
} from "../dto/trip-search.dto";

// ─────────────────────────────────────────────────────
// HARD FILTERS — appliqués TOUJOURS, non-négociables
// ─────────────────────────────────────────────────────
//
// Ces 3 filtres garantissent qu'aucun client (web, mobile, dev curieux)
// ne puisse voir des trips passés, brouillons, ou annulés via la search.
// ─────────────────────────────────────────────────────

type BaseFilterParams = {
  mode: typeof searchTripsQuerySchema._output.mode;
  from?: string;
  to?: string;
  dateFrom?: Date;
  dateTo?: Date;
  categories: UiParcelCategory[];
  departureBuckets: DepartureBucket[];
};

/**
 * Construit le `where` Prisma commun aux 2 endpoints.
 * Les soft toggles (superTripper, instantBooking, etc.) sont appliqués
 * APRÈS, séparément, parce qu'ils ne participent pas au baseWhere des facets.
 *
 * @param opts.ignoreMode - permet de retirer le filtre transportMode pour
 *   les counts par mode dans /facets (on veut compter le total dans chaque
 *   mode, peu importe le mode actuellement sélectionné côté UI).
 */
function buildBaseWhere(
  params: BaseFilterParams,
  opts: { ignoreMode?: boolean } = {}
): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = {
    status: "PUBLISHED",
  //  cancelledAt: null,
  };

  // ─── Date range ──────────────────────────────────
  // dateFrom override la borne "now()" SEULEMENT s'il est dans le futur.
  // Sinon on garde now() (un user qui demande dateFrom dans le passé n'aura
  // jamais de trip rétroactif, c'est volontaire).
  const now = new Date();
  const effectiveFrom =
    params.dateFrom && params.dateFrom > now ? params.dateFrom : now;
  const departureAtFilter: { gte: Date; lte?: Date } = { gte: effectiveFrom };
  if (params.dateTo) departureAtFilter.lte = params.dateTo;
  where.departureAt = departureAtFilter;

  // ─── Mode ─────────────────────────────────────────
  if (params.mode !== "all" && !opts.ignoreMode) {
    where.transportMode = transportModeUiToDb(params.mode as UiTransportMode);
  }

  // ─── Filtres composables (AND) ────────────────────
  const andClauses: Prisma.TripWhereInput[] = [];

  if (params.from) {
    andClauses.push({
      OR: [
        { originCity: { contains: params.from, mode: "insensitive" } },
        { originCountry: { contains: params.from, mode: "insensitive" } },
      ],
    });
  }

  if (params.to) {
    andClauses.push({
      OR: [
        { destinationCity: { contains: params.to, mode: "insensitive" } },
        { destinationCountry: { contains: params.to, mode: "insensitive" } },
      ],
    });
  }

  // Categories : au moins une des acceptedCategories doit matcher (hasSome)
  if (params.categories.length > 0) {
    where.acceptedCategories = {
      hasSome: params.categories.map(parcelCategoryUiToDb),
    };
  }

  // Departure buckets : OR des conditions horaires
  if (params.departureBuckets.length > 0) {
    const orClauses: Prisma.TripWhereInput[] = params.departureBuckets.map(
      (b) => bucketToHourCondition(b) as Prisma.TripWhereInput
    );
    andClauses.push({ OR: orClauses });
  }

  if (andClauses.length > 0) where.AND = andClauses;

  return where;
}

/**
 * Construit l'orderBy selon le sort.
 * Le `id` en second garantit la stabilité du cursor (deux trips au même
 * prix sont triés de façon déterministe).
 */
function buildOrderBy(
  sort: "earliest" | "lowestPrice" | "bestRated"
): Prisma.TripOrderByWithRelationInput[] {
  if (sort === "lowestPrice") {
    // ⚠️ MongoDB ne supporte pas `nulls: 'last'`.
    // Les trips sans minPriceCents sont exclus côté `where` (voir searchTrips).
    return [{ minPriceCents: "asc" }, { id: "asc" }];
  }
  if (sort === "bestRated") {
    // En desc, MongoDB met les nulls en dernier naturellement → parfait.
    return [{ carrierRatingSnapshot: "desc" }, { id: "asc" }];
  }
  // earliest = default
  return [{ departureAt: "asc" }, { id: "asc" }];
}

// ─────────────────────────────────────────────────────
// GET /trips/search — résultats paginés (cursor-based)
// ─────────────────────────────────────────────────────

export const searchTrips = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = searchTripsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next(
        new ValidationError(
          `Invalid query parameters: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        )
      );
    }
    const params = parsed.data;

    // Base : hard filters + filtres structurants
    let where = buildBaseWhere({
      mode: params.mode,
      from: params.from,
      to: params.to,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      categories: params.categories,
      departureBuckets: params.departureBuckets,
    });

    // Soft toggles
    if (params.superTripper) {
      where.carrierPage = {
        ...((where.carrierPage as object) ?? {}),
        isSuperCarrier: true,
      };
    }
    if (params.profileVerified) {
      where.carrierPage = {
        ...((where.carrierPage as object) ?? {}),
        isVerified: true,
      };
    }
    if (params.instantBooking) where.instantBooking = true;
    if (params.verifiedTicket) where.ticketVerificationStatus = "VERIFIED";

    // ⭐ Quand on tri par prix, on exclut les trips sans prix défini
    // (sinon Mongo les remonte en premier en mode asc).
    if (params.sort === "lowestPrice") {
      where.minPriceCents = { not: null };
    }

    const orderBy = buildOrderBy(params.sort);

    // Cursor pagination : take limit+1 pour détecter la page suivante
    // sans avoir à faire un count séparé.
    const [items, totalCount] = await Promise.all([
      prisma.trip.findMany({
        where,
        orderBy,
        take: params.limit + 1,
        ...(params.cursor && {
          cursor: { id: params.cursor },
          skip: 1,
        }),
        include: TRIP_SEARCH_INCLUDE,
      }),
      prisma.trip.count({ where }),
    ]);

    const hasNext = items.length > params.limit;
    const trips = hasNext ? items.slice(0, params.limit) : items;
    const nextCursor = hasNext ? trips[trips.length - 1].id : null;

    // Mapping vers le DTO. On skip silencieusement les trips malformés
    // (ex: sans departureAt) plutôt que de crash toute la page.
    const mapped: YambaTripResultDto[] = [];
    for (const t of trips) {
      try {
        mapped.push(mapTripToYambaResult(t as any, params.locale));
      } catch (err) {
        console.warn(
          `[search] Skipping invalid trip ${t.id}: ${(err as Error).message}`
        );
      }
    }

    return res.status(200).json({
      trips: mapped,
      nextCursor,
      totalCount,
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────
// GET /trips/search/facets — counts pour les filtres UI
// ─────────────────────────────────────────────────────

export const searchTripsFacets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = searchFacetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next(
        new ValidationError(
          `Invalid query parameters: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        )
      );
    }
    const params = parsed.data;

    // 2 versions du baseWhere :
    //  - WITH mode → pour les counts des soft toggles (on veut le count
    //    "X trips Super Tripper PARMI le mode actif")
    //  - WITHOUT mode → pour les counts par mode (on veut savoir combien il
    //    y a dans chaque mode peu importe le mode actuellement sélectionné)
    const baseWhere = buildBaseWhere({
      mode: params.mode,
      from: params.from,
      to: params.to,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      categories: params.categories,
      departureBuckets: params.departureBuckets,
    });

    const baseWhereNoMode = buildBaseWhere(
      {
        mode: params.mode,
        from: params.from,
        to: params.to,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        categories: params.categories,
        departureBuckets: params.departureBuckets,
      },
      { ignoreMode: true }
    );

    // 9 counts en parallèle = 1 round-trip Mongo
    const [
      totalCount,
      modeAll,
      modePlane,
      modeTrain,
      modeCar,
      superTripperCount,
      profileVerifiedCount,
      instantBookingCount,
      verifiedTicketCount,
    ] = await Promise.all([
      prisma.trip.count({ where: baseWhere }),
      prisma.trip.count({ where: baseWhereNoMode }),
      prisma.trip.count({
        where: { ...baseWhereNoMode, transportMode: "PLANE" },
      }),
      prisma.trip.count({
        where: { ...baseWhereNoMode, transportMode: "TRAIN" },
      }),
      prisma.trip.count({
        where: { ...baseWhereNoMode, transportMode: "CAR" },
      }),
      prisma.trip.count({
        where: {
          ...baseWhere,
          carrierPage: {
            ...((baseWhere.carrierPage as object) ?? {}),
            isSuperCarrier: true,
          },
        },
      }),
      prisma.trip.count({
        where: {
          ...baseWhere,
          carrierPage: {
            ...((baseWhere.carrierPage as object) ?? {}),
            isVerified: true,
          },
        },
      }),
      prisma.trip.count({
        where: { ...baseWhere, instantBooking: true },
      }),
      prisma.trip.count({
        where: { ...baseWhere, ticketVerificationStatus: "VERIFIED" },
      }),
    ]);

    return res.status(200).json({
      totalCount,
      modeCount: {
        all: modeAll,
        plane: modePlane,
        train: modeTrain,
        car: modeCar,
      },
      superTripperCount,
      profileVerifiedCount,
      instantBookingCount,
      verifiedTicketCount,
    });
  } catch (err) {
    return next(err);
  }
};
