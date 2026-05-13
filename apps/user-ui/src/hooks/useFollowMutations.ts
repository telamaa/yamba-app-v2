import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PublicUser } from "@/lib/public-user.types";
import type { FollowingItem } from "@/lib/following.types";

export function useFollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
                         slug,
                         notifyNextTrip = true,
                       }: {
      slug: string;
      notifyNextTrip?: boolean;
    }) => {
      return apiFetch(`/users/${slug}/follow`, {
        method: "POST",
        body: JSON.stringify({ notifyNextTrip }),
      });
    },
    onMutate: async ({ slug, notifyNextTrip = true }) => {
      await queryClient.cancelQueries({ queryKey: ["public-user", slug] });

      const previous = queryClient.getQueryData<PublicUser>([
        "public-user",
        slug,
      ]);

      if (previous) {
        queryClient.setQueryData<PublicUser>(["public-user", slug], {
          ...previous,
          follow: {
            ...previous.follow,
            isFollowedByMe: true,
            notifyNextTrip,
            followersCount: previous.follow.isFollowedByMe
              ? previous.follow.followersCount
              : previous.follow.followersCount + 1,
          },
        });
      }

      return { previous };
    },
    onError: (_err, { slug }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["public-user", slug], context.previous);
      }
    },
    onSettled: (_data, _err, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["public-user", slug] });
      // ✨ NEW : refetch la liste following pour faire apparaître le nouveau follow
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slug: string) => {
      return apiFetch(`/users/${slug}/follow`, {
        method: "DELETE",
      });
    },
    onMutate: async (slug) => {
      await queryClient.cancelQueries({ queryKey: ["public-user", slug] });
      await queryClient.cancelQueries({ queryKey: ["following"] }); // ✨ NEW

      const previous = queryClient.getQueryData<PublicUser>([
        "public-user",
        slug,
      ]);
      // ✨ NEW : snapshot du cache following
      const previousFollowing = queryClient.getQueryData<FollowingItem[]>([
        "following",
      ]);

      if (previous) {
        queryClient.setQueryData<PublicUser>(["public-user", slug], {
          ...previous,
          follow: {
            ...previous.follow,
            isFollowedByMe: false,
            notifyNextTrip: null,
            followersCount: previous.follow.isFollowedByMe
              ? Math.max(0, previous.follow.followersCount - 1)
              : previous.follow.followersCount,
          },
        });
      }

      // ✨ NEW : retire l'item de la liste following immédiatement
      if (previousFollowing) {
        queryClient.setQueryData<FollowingItem[]>(
          ["following"],
          previousFollowing.filter((item) => item.user.publicSlug !== slug)
        );
      }

      return { previous, previousFollowing };
    },
    onError: (_err, slug, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["public-user", slug], context.previous);
      }
      // ✨ NEW : rollback du cache following
      if (context?.previousFollowing) {
        queryClient.setQueryData(["following"], context.previousFollowing);
      }
    },
    onSettled: (_data, _err, slug) => {
      queryClient.invalidateQueries({ queryKey: ["public-user", slug] });
      // ✨ NEW
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

export function useUpdateFollowPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
                         slug,
                         notifyNextTrip,
                       }: {
      slug: string;
      notifyNextTrip: boolean;
    }) => {
      return apiFetch(`/users/${slug}/follow`, {
        method: "PATCH",
        body: JSON.stringify({ notifyNextTrip }),
      });
    },
    onMutate: async ({ slug, notifyNextTrip }) => {
      await queryClient.cancelQueries({ queryKey: ["public-user", slug] });
      await queryClient.cancelQueries({ queryKey: ["following"] }); // ✨ NEW

      const previous = queryClient.getQueryData<PublicUser>([
        "public-user",
        slug,
      ]);
      // ✨ NEW
      const previousFollowing = queryClient.getQueryData<FollowingItem[]>([
        "following",
      ]);

      if (previous) {
        queryClient.setQueryData<PublicUser>(["public-user", slug], {
          ...previous,
          follow: { ...previous.follow, notifyNextTrip },
        });
      }

      // ✨ NEW : flip notifyNextTrip dans la liste following
      if (previousFollowing) {
        queryClient.setQueryData<FollowingItem[]>(
          ["following"],
          previousFollowing.map((item) =>
            item.user.publicSlug === slug
              ? { ...item, notifyNextTrip }
              : item
          )
        );
      }

      return { previous, previousFollowing };
    },
    onError: (_err, { slug }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["public-user", slug], context.previous);
      }
      // ✨ NEW
      if (context?.previousFollowing) {
        queryClient.setQueryData(["following"], context.previousFollowing);
      }
    },
    onSettled: (_data, _err, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["public-user", slug] });
      // ✨ NEW
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}
