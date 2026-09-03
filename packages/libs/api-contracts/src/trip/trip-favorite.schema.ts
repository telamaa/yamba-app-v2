/**
 * trip-favorite.schema.ts — favoris de trajets (D46)
 * ==================================================
 * POST   /trips/:id/favorite  → TripFavoriteState (idempotent)
 * DELETE /trips/:id/favorite  → TripFavoriteState (idempotent)
 * GET    /trips/favorites     → FavoriteTripsResponse (cartes de recherche, isFavorite = true)
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { YambaTripResultSchema } from "./trip-search.schema";

export const TripFavoriteStateSchema = z
  .object({
    tripId: ObjectIdSchema,
    isFavorite: z.boolean(),
  })
  .strict()
  .meta({ id: "TripFavoriteState", description: "État du favori après l'action (idempotent)" });
export type TripFavoriteState = z.infer<typeof TripFavoriteStateSchema>;

export const FavoriteTripsResponseSchema = z
  .object({
    trips: z.array(YambaTripResultSchema),
    totalCount: z.number().int(),
  })
  .strict()
  .meta({ id: "FavoriteTripsResponse", description: "Mes favoris — du plus récent au plus ancien, trajets passés inclus" });
export type FavoriteTripsResponse = z.infer<typeof FavoriteTripsResponseSchema>;

/** Codes d'erreur métier (details.type = "favorite"). */
export const TRIP_FAVORITE_ERROR_CODES = ["TRIP_NOT_FAVORITABLE", "OWN_TRIP"] as const;
export type TripFavoriteErrorCode = (typeof TRIP_FAVORITE_ERROR_CODES)[number];
