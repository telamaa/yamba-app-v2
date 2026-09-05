/**
 * usePricingParams — les paramètres de prix servis par la plateforme (C-PR8a, D62 7A)
 * ==================================================================================
 * `GET /trips/pricing/params` (public, cache 30 s côté serveur). Tant que la réponse
 * n'est pas là, le wizard calcule avec les défauts du moteur (`PRICING_PARAMS`, identiques
 * aux valeurs du serveur tant qu'aucun admin n'a rien changé). Un admin qui modifie la
 * commission entre l'affichage et le paiement fait échouer le devis serveur (400) : le
 * checkout relit alors ces paramètres.
 */
import { useQuery } from "@tanstack/react-query";
import { PRICING_PARAMS, type PricingParams } from "@packages/pricing";
import apiClient from "@/lib/api-client";

export type PricingParamsPayload = PricingParams & { version: number };

export const PRICING_PARAMS_QUERY_KEY = ["pricing-params"] as const;

export async function fetchPricingParams(): Promise<PricingParamsPayload> {
  const res = await apiClient.get<PricingParamsPayload>("/trips/pricing/params");
  return res.data;
}

export function usePricingParams(): PricingParams {
  const { data } = useQuery({
    queryKey: PRICING_PARAMS_QUERY_KEY,
    queryFn: fetchPricingParams,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return data ?? PRICING_PARAMS;
}
