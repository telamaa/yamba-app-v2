/**
 * useWallet — GET /me/wallet (A83) : portefeuille Voyageur + paiements Expéditeur.
 * Totaux calculés SERVEUR (décision 2A) ; le front affiche, ne recalcule jamais.
 */
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { WalletResponse } from "@/components/dashboard/finances/wallet.types";

export const WALLET_QUERY_KEY = ["wallet"] as const;

export function useWallet(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<WalletResponse>("/me/wallet", { requireAuth: true });
      return res.data;
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}
