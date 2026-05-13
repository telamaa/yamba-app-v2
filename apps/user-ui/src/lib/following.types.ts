/**
 * Types matching le DTO retourné par GET /api/me/following.
 *
 * Source de vérité :
 *   apps/auth-service/src/controller/user-public.controller.ts → listMyFollowing
 */

export type FollowingUser = {
  id: string;
  publicSlug: string | null;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  isCarrier: boolean;
  carrierRatingAvg: number | null;
  carrierRatingCount: number;
  totalTripsPublished: number;
  nextUpcomingTrip: {
    id: string;
    originCity: string;
    destinationCity: string;
    departureAt: string; // ISO
  } | null;
};

export type FollowingItem = {
  user: FollowingUser;
  followedAt: string; // ISO
  notifyNextTrip: boolean;
};

export type GetFollowingResponse = {
  success: boolean;
  count: number;
  following: FollowingItem[];
};
