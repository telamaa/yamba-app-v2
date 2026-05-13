import express, { Router } from "express";
import {
  getUserPublic,
  listUserPublicReviews,
  listUserPublicTrips,
  followUser,
  unfollowUser,
  updateFollowPreferences, listMyFollowing,
} from "../controller/user-public.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import isOptionallyAuthenticated from "@packages/middleware/isOptionallyAuthenticated";

const router: Router = express.Router();

// ─── Endpoints publics (auth optionnelle) ──────────────
// Si l'user est connecté, on enrichit avec isFollowedByMe / isOwnProfile.
// Si non connecté, l'endpoint répond quand même mais sans personnalisation.
router.get("/users/:slug/public", isOptionallyAuthenticated, getUserPublic);
router.get(
  "/users/:slug/public/reviews",
  isOptionallyAuthenticated,
  listUserPublicReviews
);
router.get(
  "/users/:slug/public/trips",
  isOptionallyAuthenticated,
  listUserPublicTrips
);

// ─── Endpoints follow (auth requise) ───────────────────
router.post("/users/:slug/follow", isAuthenticated, followUser);
router.delete("/users/:slug/follow", isAuthenticated, unfollowUser);
router.patch("/users/:slug/follow", isAuthenticated, updateFollowPreferences);
router.get("/me/following", isAuthenticated, listMyFollowing);

export default router;
