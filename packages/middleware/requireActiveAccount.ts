/**
 * requireActiveAccount — un compte RESTREINT ou SUSPENDU ne publie ni ne réserve (C-PR3, D56 2A)
 * ==============================================================================================
 * À poser APRÈS isAuthenticated sur les routes de création (trajet, réservation).
 * Les deals en cours continuent : les autres routes ne sont pas bloquées.
 */
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./isAuthenticated";

const requireActiveAccount = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const status = (req.user as { accountStatus?: string } | undefined)?.accountStatus ?? "ACTIVE";
  if (status === "RESTRICTED" || status === "SUSPENDED") {
    return res.status(403).json({ message: "Your account is restricted: you cannot publish or book for now.", code: "ACCOUNT_RESTRICTED" });
  }
  return next();
};

export default requireActiveAccount;
