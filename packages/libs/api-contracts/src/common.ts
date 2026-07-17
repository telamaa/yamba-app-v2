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

/* ══ Erreurs (packages/error-handler → error-middleware) ══════ */

/**
 * Format sérialisé par errorMiddleware pour toute AppError
 * (ValidationError 400, AuthError 401, ForbiddenError 403,
 * NotFoundError 404, ConflictError 409, RateLimitError 429,
 * DatabaseError 500).
 *
 * ⚠️ Réalité du trip-service (Lot B) : le controller lève
 * ValidationError (→ 400) pour TOUT, y compris "Trip not found."
 * et "Unauthorized." (ownership). PR future fix/error-semantics
 * pour basculer sur NotFoundError/ForbiddenError.
 */
export const ErrorResponseSchema = z
  .object({
    status: z.literal("error"),
    message: z.string().meta({ example: "Trip not found." }),
    errors: z
      .record(z.string(), z.string())
      .optional()
      .meta({ description: "Erreurs par champ (formulaires) — exposé quand details.errors est présent" }),
    details: z
      .unknown()
      .optional()
      .meta({ description: "Contexte structuré 'safe' (ex: type=otp) — toujours exposé ; le reste hors prod uniquement" }),
  })
  .meta({
    id: "ErrorResponse",
    description: "Enveloppe d'erreur standard (error-middleware, toute AppError)",
  });
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Erreur NON gérée (hors AppError) : le middleware renvoie un 500 avec
 * un champ `error` (et non `message`). Format distinct, fidèle au réel.
 */
export const UnhandledErrorSchema = z
  .object({
    status: z.literal("error"),
    error: z.string().meta({ example: "Something went wrong, please try again!" }),
  })
  .meta({
    id: "UnhandledError",
    description: "500 non géré (exception hors AppError) — champ `error`, pas `message`",
  });
export type UnhandledError = z.infer<typeof UnhandledErrorSchema>;

/**
 * 401 renvoyé DIRECTEMENT par le middleware isAuthenticated
 * (packages/middleware) : { message } tout court — ni status ni success.
 * Quatrième format d'erreur de la plateforme, fidèle au réel.
 */
export const UnauthorizedResponseSchema = z
  .object({
    message: z.string().meta({ example: "Unauthorized! Token missing." }),
  })
  .meta({
    id: "UnauthorizedResponse",
    description:
      "401 du middleware isAuthenticated (token absent, invalide, expiré, ou compte introuvable) — hors error-middleware",
  });
export type UnauthorizedResponse = z.infer<typeof UnauthorizedResponseSchema>;
