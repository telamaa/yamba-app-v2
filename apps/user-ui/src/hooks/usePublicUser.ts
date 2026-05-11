import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";
import type { PublicUser } from "@/lib/public-user.types";

type ApiResponse = {
  success: boolean;
  user: PublicUser;
};

export function usePublicUser(slug: string) {
  return useQuery<PublicUser>({
    queryKey: ["public-user", slug],
    queryFn: async () => {
      const data = await apiFetch<ApiResponse>(
        `/users/${slug}/public`
      );
      return data.user;
    },
    enabled: !!slug,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      // Pas de retry sur 404 (user introuvable)
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
}
