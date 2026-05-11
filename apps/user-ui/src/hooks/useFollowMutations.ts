import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PublicUser } from "@/lib/public-user.types";

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

      const previous = queryClient.getQueryData<PublicUser>([
        "public-user",
        slug,
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

      return { previous };
    },
    onError: (_err, slug, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["public-user", slug], context.previous);
      }
    },
    onSettled: (_data, _err, slug) => {
      queryClient.invalidateQueries({ queryKey: ["public-user", slug] });
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

      const previous = queryClient.getQueryData<PublicUser>([
        "public-user",
        slug,
      ]);

      if (previous) {
        queryClient.setQueryData<PublicUser>(["public-user", slug], {
          ...previous,
          follow: { ...previous.follow, notifyNextTrip },
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
    },
  });
}
