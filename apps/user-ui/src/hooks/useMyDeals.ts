"use client";

/**
 * useMyDeals — mes deals reçus (vue Voyageur, tous trajets — A44)
 * ================================================================
 * GET /me/deals (gateway → deal-service). UNE lecture partagée par
 * « Mes trajets » (bande « À traiter » + deals par trajet), l'accueil du
 * dashboard et le badge de la sidebar — même queryKey, même cache.
 * Les transitions du module carrier/deal invalident ["my-deals"] en plus
 * de ["deal", id].
 */

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { CarrierBookingViewDto } from "@/components/carrier/deal/deal.adapter";

export const MY_DEALS_QUERY_KEY = ["my-deals"] as const;

type MyDealsResponse = {
  success: boolean;
  deals: CarrierBookingViewDto[];
  count: number;
};

export function useMyDeals(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: MY_DEALS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<MyDealsResponse>("/me/deals", { requireAuth: true });
      return res.data.deals;
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}
