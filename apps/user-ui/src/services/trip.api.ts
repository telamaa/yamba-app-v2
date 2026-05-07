import axiosInstance from "@/lib/api-client";
import type {
  ParcelCategory,
  SortOption,
  TransportMode,
  DepartureTimeBucket,
  YambaTripResult,
} from "@/components/search/search-results.types";

// ─── Types ──────────────────────────────────────────

export type SearchTripsParams = {
  mode?: "all" | TransportMode;
  from?: string;
  to?: string;
  dateFrom?: string;     // ISO
  dateTo?: string;       // ISO
  sort?: SortOption;
  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;
  categories?: ParcelCategory[];
  departureBuckets?: DepartureTimeBucket[];
  cursor?: string | null;
  limit?: number;
  locale?: "fr" | "en";
};

export type SearchTripsPage = {
  trips: YambaTripResult[];
  nextCursor: string | null;
  totalCount: number;
};

export type SearchFacetsParams = {
  mode?: SearchTripsParams["mode"];
  from?: SearchTripsParams["from"];
  to?: SearchTripsParams["to"];
  dateFrom?: SearchTripsParams["dateFrom"];
  dateTo?: SearchTripsParams["dateTo"];
  categories?: SearchTripsParams["categories"];
  departureBuckets?: SearchTripsParams["departureBuckets"];
  locale?: SearchTripsParams["locale"];
};

export type SearchFacets = {
  totalCount: number;
  modeCount: { all: number; plane: number; train: number; car: number };
  superTripperCount: number;
  profileVerifiedCount: number;
  instantBookingCount: number;
  verifiedTicketCount: number;
};

// ─── Helpers ────────────────────────────────────────

/**
 * Construit une URLSearchParams en omettant les valeurs falsy/empty,
 * pour des URLs propres (pas de `?from=&to=&superTripper=false` parasites).
 */
function buildQueryString(params: SearchTripsParams): string {
  const qs = new URLSearchParams();

  if (params.mode && params.mode !== "all") qs.set("mode", params.mode);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.sort && params.sort !== "earliest") qs.set("sort", params.sort);

  if (params.superTripper) qs.set("superTripper", "true");
  if (params.profileVerified) qs.set("profileVerified", "true");
  if (params.instantBooking) qs.set("instantBooking", "true");
  if (params.verifiedTicket) qs.set("verifiedTicket", "true");

  if (params.categories?.length) qs.set("categories", params.categories.join(","));
  if (params.departureBuckets?.length)
    qs.set("departureBuckets", params.departureBuckets.join(","));

  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.locale) qs.set("locale", params.locale);

  return qs.toString();
}

// ─── API ────────────────────────────────────────────

/**
 * GET /api/trips/search — résultats paginés (cursor-based).
 *
 * Toutes les requêtes passent par la gateway (port 8080), qui forward
 * vers trip-service (port 6002). Pas d'auth requise sur cet endpoint.
 */
export async function searchTrips(
  params: SearchTripsParams
): Promise<SearchTripsPage> {
  const qs = buildQueryString(params);
  const res = await axiosInstance.get<SearchTripsPage>(
    `/trips/search${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

/**
 * GET /api/trips/search/facets — counts pour les filtres UI.
 *
 * Séparé de searchTrips pour ne pas recompter les facets à chaque
 * fetchNextPage() de l'infinite scroll.
 */
export async function getSearchFacets(
  params: SearchFacetsParams
): Promise<SearchFacets> {
  const qs = buildQueryString(params);
  const res = await axiosInstance.get<SearchFacets>(
    `/trips/search/facets${qs ? `?${qs}` : ""}`
  );
  return res.data;
}
