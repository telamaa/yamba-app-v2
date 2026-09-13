import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  SavedRoute,
  CreateSavedRoutePayload,
  UpdateSavedRoutePayload,
} from "@/lib/saved-route.types";

type CreateResponse = {
  success: boolean;
  message: string;
  savedRoute: SavedRoute;
};

type UpdateResponse = {
  success: boolean;
  message: string;
  savedRoute: SavedRoute;
};

/**
 * Hook : créer une nouvelle alerte route.
 */
export function useCreateSavedRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSavedRoutePayload) => {
      return apiFetch<CreateResponse>("/saved-routes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });
}

/**
 * Hook : mettre à jour une alerte existante (dates, prefs).
 */
export function useUpdateSavedRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
                         id,
                         payload,
                       }: {
      id: string;
      payload: UpdateSavedRoutePayload;
    }) => {
      return apiFetch<UpdateResponse>(`/saved-routes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });
}

/**
 * Hook : supprimer une alerte (idempotent).
 * Optimistic update : retire de la liste immédiatement, rollback si erreur.
 */
/**
 * ANO-WEB-29 (recette 5.10) — les retours (toast) se passent ICI, au niveau du hook, pas dans
 * les options de `mutate(...)` : la suppression est OPTIMISTE (`onMutate` retire la carte tout de
 * suite), la carte est DÉMONTÉE avant la réponse, et TanStack Query n'appelle jamais les
 * callbacks passés à `mutate` d'un composant démonté. Les callbacks du hook, eux, sont portés par
 * la mutation elle-même et survivent au démontage.
 */
export function useDeleteSavedRoute(retours: { onSuccess?: () => void; onError?: () => void } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/saved-routes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      retours.onSuccess?.();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["saved-routes"] });

      const previous = queryClient.getQueryData<SavedRoute[]>([
        "saved-routes",
        { includeInactive: false },
      ]);

      if (previous) {
        queryClient.setQueryData<SavedRoute[]>(
          ["saved-routes", { includeInactive: false }],
          previous.filter((r) => r.id !== id)
        );
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["saved-routes", { includeInactive: false }],
          context.previous
        );
      }
      retours.onError?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });
}

/**
 * Hook : prolonger une alerte de 6 mois.
 */
export function useExtendSavedRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<UpdateResponse>(`/saved-routes/${id}/extend`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });
}
