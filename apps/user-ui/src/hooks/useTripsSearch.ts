"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { searchTrips, type SearchTripsParams } from "@/services/trip.api";

const PAGE_SIZE = 10;

/**
 * Hook principal pour la search de trips avec pagination cursor-based.
 *
 * ⚠️ Stabilité de la queryKey :
 * Le composant qui consomme ce hook DOIT passer un objet `params` stable
 * (typiquement via `useMemo`). Sinon, à chaque render, React Query verra
 * une nouvelle clé et déclenchera un re-fetch infini.
 *
 * Usage :
 *   const params = useMemo(() => ({ mode, sort, ... }), [mode, sort, ...]);
 *   const query = useTripsSearch(params);
 *   const trips = query.data?.pages.flatMap(p => p.trips) ?? [];
 */
export function useTripsSearch(params: SearchTripsParams) {
  return useInfiniteQuery({
    queryKey: ["trips-search", params],
    queryFn: ({ pageParam }) =>
      searchTrips({
        ...params,
        cursor: pageParam,
        limit: params.limit ?? PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 2, // 2 min — la search peut tolérer un peu de stale
    gcTime: 1000 * 60 * 5,
  });
}
