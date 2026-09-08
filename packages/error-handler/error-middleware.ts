import { AppError } from "./index";
import { captureServerError } from "./sentry";
import { Request, Response, NextFunction } from "express";

/**
 * Middleware global de gestion d'erreurs Express pour Yamba.
 *
 * Format de réponse :
 *   { status: "error", message: "...", code?: "...", errors?: {...}, details?: {...} }
 *
 * `details` est exposé même en production quand il contient un contexte
 * structuré "safe" (ex: OTP exponential backoff avec attemptsLeft, locked).
 * Les détails de debug sensibles (stacktraces, etc.) restent masqués en prod.
 *
 * Dette D-5 (recette API 08/09/2026) — `code` est aussi recopié au PREMIER NIVEAU quand
 * `details.code` existe. Raison : plusieurs middlewares écrivaient leur réponse eux-mêmes,
 * avec le code en tête, et des clients le lisent là. En le recopiant ici, ces middlewares
 * peuvent enfin passer par ce middleware — une seule forme de corps d'erreur pour toute la
 * plateforme — sans qu'aucun client existant cesse de fonctionner. Les deux formes disent la
 * même chose ; `details.code` reste la forme de référence.
 */
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err instanceof AppError) {
    console.log(`Error ${req.method} ${req.url} - ${err.message}`);

    const isProd = process.env.NODE_ENV === "production";

    const payload: {
      status: string;
      message: string;
      code?: string;
      errors?: Record<string, string>;
      details?: unknown;
    } = {
      status: "error",
      message: err.message,
    };

    // Traitement structuré de details
    if (err.details && typeof err.details === "object" && !Array.isArray(err.details)) {
      const detailsObj = err.details as Record<string, unknown>;

      // Cas 1 : details = { errors: { field: msg } } → expose au top level pour les forms
      if (detailsObj.errors && typeof detailsObj.errors === "object") {
        payload.errors = detailsObj.errors as Record<string, string>;
      }

      // Cas 2 : details a un type connu et "safe" → on l'expose toujours (même en prod)
      // Liste des types safe : "otp" (exponential backoff), à étendre selon les besoins
      // "booking" : codes métier 409 du deal-service (B2) · "password" / "register" :
      // codes de règle (auth-service, recette 03/09) traduits par le front
      const safeTypes = ["otp", "booking", "password", "register", "locale", "favorite", "oauth", "trip"];
      const detailsType = detailsObj.type as string | undefined;

      // A146 — un `code` est PUBLIC par contrat : le client le lit et le traduit.
      // Avant, un code posé sans `type` disparaissait en production et cassait la
      // fonctionnalité qui en dépendait (SUDO_REQUIRED, refus de la messagerie…).
      const hasPublicCode = typeof detailsObj.code === "string" && detailsObj.code.length > 0;

      if (hasPublicCode || (detailsType && safeTypes.includes(detailsType))) {
        payload.details = err.details;
        // D-5 — le même code, aussi en tête : voir l'en-tête de fichier.
        if (hasPublicCode) payload.code = detailsObj.code as string;
      } else if (!isProd) {
        // Cas 3 : details non typé ou type inconnu → exposé seulement hors prod (debug)
        payload.details = err.details;
      }
    }

    // Log les erreurs serveur (5xx) en plus de la réponse
    if (err.statusCode >= 500) {
      captureServerError(err, req); // C-PR3 (D56 7A) — Sentry, tagué correlationId
      console.error("[error-handler] Server error:", {
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        stack: err.stack,
      });
    }

    return res.status(err.statusCode).json(payload);
  }

  console.log("Unhandled error: ", err);
  captureServerError(err, req); // C-PR3 (D56 7A) — erreur non opérationnelle : toujours remontée

  return res.status(500).json({
    status: "error",
    error: "Something went wrong, please try again!",
  });
};
