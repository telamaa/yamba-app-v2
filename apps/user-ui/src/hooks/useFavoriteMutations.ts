/**
 * useFavoriteMutations — cœur optimiste (D46, A59)
 * ================================================
 * Un clic = état inversé IMMÉDIATEMENT dans tous les caches qui montrent ce
 * trajet (fiche publique, pages de recherche infinies, liste des favoris),
 * puis l'API tranche ; en erreur, tout est remis comme avant. Le serveur
 * reste seul juge des règles (propre trajet, trajet non publié) : le front
 * ne fait que refléter.
 */
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { addTripFavorite, removeTripFavorite, type FavoriteTripsResponse } from "@/services/favorite.api";
import { FAVORITES_QUERY_KEY } from "./useFavoriteTrips";

type SearchPage = { trips: Array<{ id: string; isFavorite?: boolean }> };
type PublicTripCache = { isFavorite?: boolean } | undefined;

function patchSearchPages(data: InfiniteData<SearchPage> | undefined, tripId: string, isFavorite: boolean) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      trips: page.trips.map((t) => (t.id === tripId ? { ...t, isFavorite } : t)),
    })),
  };
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, next }: { tripId: string; next: boolean }) =>
      next ? addTripFavorite(tripId) : removeTripFavorite(tripId),

    onMutate: async ({ tripId, next }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["public-trip", tripId] }),
        queryClient.cancelQueries({ queryKey: ["trips-search"] }),
        queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY }),
      ]);
      const previousTrip = queryClient.getQueryData<PublicTripCache>(["public-trip", tripId]);
      const previousSearch = queryClient.getQueriesData<InfiniteData<SearchPage>>({ queryKey: ["trips-search"] });
      const previousFavorites = queryClient.getQueriesData<FavoriteTripsResponse>({ queryKey: FAVORITES_QUERY_KEY });

      if (previousTrip) queryClient.setQueryData(["public-trip", tripId], { ...previousTrip, isFavorite: next });
      queryClient.setQueriesData<InfiniteData<SearchPage>>({ queryKey: ["trips-search"] }, (old) =>
        patchSearchPages(old, tripId, next)
      );
      if (!next) {
        queryClient.setQueriesData<FavoriteTripsResponse>({ queryKey: FAVORITES_QUERY_KEY }, (old) =>
          old ? { trips: old.trips.filter((t) => t.id !== tripId), totalCount: Math.max(0, old.totalCount - 1) } : old
        );
      }
      return { previousTrip, previousSearch, previousFavorites };
    },

    onError: (_error, { tripId }, context) => {
      if (!context) return;
      if (context.previousTrip) queryClient.setQueryData(["public-trip", tripId], context.previousTrip);
      for (const [key, data] of context.previousSearch) queryClient.setQueryData(key, data);
      for (const [key, data] of context.previousFavorites) queryClient.setQueryData(key, data);
    },

    onSettled: (_data, _error, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["public-trip", tripId] });
    },
  });
}
