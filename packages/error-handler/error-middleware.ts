import { AppError } from "./index";
import { Request, Response, NextFunction } from "express";

/**
 * Middleware global de gestion d'erreurs Express pour Yamba.
 *
 * Format de réponse :
 *   { status: "error", message: "...", errors?: {...}, details?: {...} }
 *
 * `details` est exposé même en production quand il contient un contexte
 * structuré "safe" (ex: OTP exponential backoff avec attemptsLeft, locked).
 * Les détails de debug sensibles (stacktraces, etc.) restent masqués en prod.
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
      const safeTypes = ["otp"];
      const detailsType = detailsObj.type as string | undefined;

      if (detailsType && safeTypes.includes(detailsType)) {
        payload.details = err.details;
      } else if (!isProd) {
        // Cas 3 : details non typé ou type inconnu → exposé seulement hors prod (debug)
        payload.details = err.details;
      }
    }

    // Log les erreurs serveur (5xx) en plus de la réponse
    if (err.statusCode >= 500) {
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

  return res.status(500).json({
    status: "error",
    error: "Something went wrong, please try again!",
  });
};
