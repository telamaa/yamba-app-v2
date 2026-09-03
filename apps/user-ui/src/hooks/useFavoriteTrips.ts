import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { listFavoriteTrips } from "@/services/favorite.api";

export const FAVORITES_QUERY_KEY = ["favorites"] as const;

/** Mes favoris (D46) — cartes de recherche, du plus récent au plus ancien. */
export function useFavoriteTrips() {
  const locale = useLocale();
  return useQuery({
    queryKey: [...FAVORITES_QUERY_KEY, locale],
    queryFn: () => listFavoriteTrips(locale),
    staleTime: 60 * 1000,
  });
}
