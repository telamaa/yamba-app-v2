/**
 * usePublicTrip — Hook React Query pour récupérer un trip public
 *
 * Appel non-authentifié à GET /trips/:id/public.
 * Pas de { requireAuth: true } parce que la route est publique.
 */

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { PublicTrip, PublicTripResponse } from "@/lib/public-trip.types";

const BASE = "/trips";

export function usePublicTrip(tripId: string | null) {
  return useQuery<PublicTrip, Error>({
    queryKey: ["public-trip", tripId],
    queryFn: async () => {
      if (!tripId) throw new Error("Trip id is required");
      const res = await apiClient.get<PublicTripResponse>(
        `${BASE}/${tripId}/public`
      );
      return res.data.trip;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const status = (error as any)?.response?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}
