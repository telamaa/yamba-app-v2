import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SavedRoute } from "@/lib/saved-route.types";

type ApiResponse = {
  success: boolean;
  savedRoutes: SavedRoute[];
  count: number;
};

/**
 * Hook : liste les alertes de route actives du user connecté.
 *
 * @param options.includeInactive Inclure les alertes désactivées (par défaut: false)
 */
export function useSavedRoutes(options: { includeInactive?: boolean } = {}) {
  const { includeInactive = false } = options;

  return useQuery<SavedRoute[]>({
    queryKey: ["saved-routes", { includeInactive }],
    queryFn: async () => {
      const data = await apiFetch<ApiResponse>(
        `/saved-routes${includeInactive ? "?includeInactive=true" : ""}`
      );
      return data.savedRoutes;
    },
    staleTime: 60 * 1000, // 1 min
  });
}
