"use client";

import { useQuery } from "@tanstack/react-query";
import { getSearchFacets, type SearchFacetsParams } from "@/services/trip.api";

/**
 * Hook pour les counts de filtres affichés dans la sidebar.
 *
 * Volontairement séparé de useTripsSearch pour 2 raisons :
 *  1. Les facets ne se recomptent pas quand on scroll (pagination).
 *  2. Le baseWhere côté serveur exclut les soft toggles (super tripper, etc.)
 *     pour permettre de compter "combien de trips Super Tripper PARMI les
 *     filtres structurants actifs".
 *
 * ⚠️ Comme useTripsSearch, params doit être stable (useMemo).
 */
export function useSearchFacets(params: SearchFacetsParams) {
  return useQuery({
    queryKey: ["trips-search-facets", params],
    queryFn: () => getSearchFacets(params),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    // Garde les anciennes données pendant le re-fetch pour éviter
    // que les counts disparaissent à chaque toggle de filtre structurant.
    placeholderData: (previousData) => previousData,
  });
}
