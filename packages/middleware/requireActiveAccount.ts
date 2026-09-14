/**
 * requireActiveAccount — un compte RESTREINT ou SUSPENDU ne publie ni ne réserve (C-PR3, D56 2A)
 * ==============================================================================================
 * À poser APRÈS isAuthenticated sur les routes de création (trajet, réservation).
 * Les deals en cours continuent : les autres routes ne sont pas bloquées.
 */
import type { NextFunction, Response } from "express";
import { ForbiddenError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "./isAuthenticated";
import { effectiveAccountStatus, type SanctionState } from "./account-status";

const requireActiveAccount = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // ANO-ADM-07 — statut EFFECTIF : une restriction dont la date de fin est passée ne bloque plus.
  const status = effectiveAccountStatus((req.user as SanctionState | undefined) ?? {});
  if (status === "RESTRICTED" || status === "SUSPENDED") {
    // D-5 : passe par le middleware d'erreur commun ; le code reste servi en tête ET dans `details`.
    return next(
      new ForbiddenError("Your account is restricted: you cannot publish or book for now.", { code: "ACCOUNT_RESTRICTED" })
    );
  }
  return next();
};

export default requireActiveAccount;
