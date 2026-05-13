import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  FollowingItem,
  GetFollowingResponse,
} from "@/lib/following.types";

/**
 * Hook : liste les Trippers suivis par le user connecté.
 * Triés : trajets à venir d'abord, puis par date de follow récente.
 */
export function useFollowing() {
  return useQuery<FollowingItem[]>({
    queryKey: ["following"],
    queryFn: async () => {
      const data = await apiFetch<GetFollowingResponse>("/me/following");
      return data.following;
    },
    staleTime: 60 * 1000, // 1 min
  });
}
