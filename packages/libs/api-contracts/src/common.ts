import { z } from "zod";

/**
 * @packages/api-contracts — common schemas
 * ========================================
 * Primitives partagées entre toutes les surfaces (trips, deals, auth…).
 * Volontairement minimal : on n'ajoute ici que ce qui est réellement
 * consommé par au moins deux domaines.
 */

/** Identifiant MongoDB (ObjectId sérialisé) — 24 caractères hexadécimaux. */
export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Identifiant MongoDB invalide (24 hex attendus)")
  .meta({
    id: "ObjectId",
    description: "Identifiant MongoDB (ObjectId sérialisé en hexadécimal)",
    example: "665f1c2ab3d4e5f6a7b8c9d0",
  });
export type ObjectId = z.infer<typeof ObjectIdSchema>;
