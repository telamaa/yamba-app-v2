import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { sortByPriceForWeight, totalForWeightCents, transportForWeightCents } from "../lib/price-for-weight";
import prisma from "@packages/libs/prisma";
import { markFavorites } from "../services/trip-favorite.service";
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
  PARCEL_FAMILIES,
  type ParcelFamily,
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
  families: ParcelFamily[];
  weightKg?: number;
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

  // Categories (legacy PER_CATEGORY) : au moins une des acceptedCategories
  // doit matcher — MAIS un trajet PER_KG n'a pas de catégories (D14 : la
  // famille les remplace) → il passe toujours ce filtre (D33).
  if (params.categories.length > 0) {
    andClauses.push({
      OR: [
        { pricePerKgCents: { gt: 0 } },
        { acceptedCategories: { hasSome: params.categories.map(parcelCategoryUiToDb) } },
      ],
    });
  }

  // Poids du colis (D33 V2) : un trajet au kilo doit pouvoir le contenir.
  // Approximation par la CAPACITÉ déclarée (Prisma/Mongo ne compare pas deux
  // champs entre eux) ; le front grise ceux dont remainingKg < poids, et la
  // réservation (CAP-01) fait la vérification exacte.
  if (params.weightKg) {
    andClauses.push({
      OR: [
        { pricePerKgCents: null },
        { pricePerKgCents: { lte: 0 } },
        { capacityKg: { gte: params.weightKg } },
      ],
    });
  }

  // Familles (D14/D33) : exclure les trajets qui REFUSENT une famille demandée.
  // Un trajet sans familyConditions accepte tout (legacy compris).
  for (const family of params.families) {
    andClauses.push({
      familyConditions: { none: { familyKey: family, mode: "REFUSE" } },
    });
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

/** D33 V2 — prix de CE colis sur cette carte (euros, tout compris). */
function enrichForWeight(
  dto: YambaTripResultDto,
  trip: { pricePerKgCents?: number | null; minPriceCents?: number | null },
  weightKg: number
): YambaTripResultDto {
  const transport = transportForWeightCents(trip, weightKg);
  const total = totalForWeightCents(trip, weightKg);
  return {
    ...dto,
    weightKg,
    transportForWeight: transport === null ? null : transport / 100,
    totalForWeight: total === null ? null : total / 100,
  };
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
    // D33 — tri sur le prix COMPARABLE (colis de référence 2 kg) : PER_KG et
    // legacy ensemble. Les trips sans valeur sont exclus côté `where`.
    return [{ comparablePriceCents: "asc" }, { id: "asc" }];
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
      families: params.families,
      weightKg: params.weightKg,
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
      where.comparablePriceCents = { not: null };
    }

    // ⭐ D33 V2 — tri par prix POUR LE POIDS SAISI : la clé dépend du poids
    // (crossover legacy/PER_KG), donc pas d'index possible → tri en mémoire
    // sur une fenêtre bornée (WEIGHT_SORT_WINDOW) avec un curseur-offset
    // « o:<n> ». Assumé v1 (volumes faibles) ; documenté dans la fiche.
    if (params.sort === "lowestPrice" && params.weightKg) {
      const WEIGHT_SORT_WINDOW = 200;
      const offset = params.cursor?.startsWith("o:") ? Number(params.cursor.slice(2)) || 0 : 0;
      const [all, totalCount] = await Promise.all([
        prisma.trip.findMany({ where, take: WEIGHT_SORT_WINDOW, include: TRIP_SEARCH_INCLUDE }),
        prisma.trip.count({ where }),
      ]);
      const sorted = sortByPriceForWeight(all, params.weightKg);
      const page = sorted.slice(offset, offset + params.limit);
      const nextCursor = offset + params.limit < sorted.length ? `o:${offset + params.limit}` : null;
      const mapped: YambaTripResultDto[] = [];
      for (const t of page) {
        try {
          mapped.push(enrichForWeight(mapTripToYambaResult(t as any, params.locale), t, params.weightKg));
        } catch (err) {
          console.warn(`[search] Skipping invalid trip ${t.id}: ${(err as Error).message}`);
        }
      }
      await markFavorites((req as { user?: { id?: string } }).user?.id, mapped); // D46
      return res.status(200).json({ trips: mapped, nextCursor, totalCount: Math.min(totalCount, sorted.length) });
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
        const dto = mapTripToYambaResult(t as any, params.locale);
        mapped.push(params.weightKg ? enrichForWeight(dto, t, params.weightKg) : dto);
      } catch (err) {
        console.warn(
          `[search] Skipping invalid trip ${t.id}: ${(err as Error).message}`
        );
      }
    }

    await markFavorites((req as { user?: { id?: string } }).user?.id, mapped); // D46 — visiteur → false

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
      families: params.families,
      weightKg: params.weightKg,
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
        families: params.families,
        weightKg: params.weightKg,
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

    // D33 — compte par famille : trajets qui NE refusent PAS la famille
    // (8 counts en parallèle, sur le baseWhere SANS filtre famille courant
    // pour que chaque chip garde son compte propre).
    const baseWhereNoFamily = buildBaseWhere({
      mode: params.mode,
      from: params.from,
      to: params.to,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      categories: params.categories,
      families: [],
      weightKg: params.weightKg,
      departureBuckets: params.departureBuckets,
    });
    const familyCountValues = await Promise.all(
      PARCEL_FAMILIES.map((family) =>
        prisma.trip.count({
          where: {
            ...baseWhereNoFamily,
            AND: [
              ...((baseWhereNoFamily.AND as Prisma.TripWhereInput[] | undefined) ?? []),
              { familyConditions: { none: { familyKey: family, mode: "REFUSE" } } },
            ],
          },
        })
      )
    );
    const familyCounts = Object.fromEntries(
      PARCEL_FAMILIES.map((family, i) => [family, familyCountValues[i]])
    ) as Record<ParcelFamily, number>;

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
      familyCounts,
    });
  } catch (err) {
    return next(err);
  }
};
