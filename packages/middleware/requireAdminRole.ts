/**
 * requireAdminRole — permission par route (C-PR3, D56 1A)
 * =======================================================
 * À poser APRÈS isAdminAuthenticated. La matrice vit dans le contrat
 * (`ADMIN_PERMISSIONS`) : SUPER_ADMIN passe partout, les autres profils sont
 * bornés par permission. Un refus est un 403 explicite (jamais un 404 : la
 * route existe, c'est le profil qui manque).
 */
import type { NextFunction, Response } from "express";
import { adminRolesAllow, type AdminPermission, type AdminRole } from "@packages/api-contracts";
import { ForbiddenError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "./isAuthenticated";

export const requireAdminPermission =
  (permission: AdminPermission) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // C-PR3bis (D60 1A) — union des profils cumulés
    const roles = (req.adminRoles && req.adminRoles.length ? req.adminRoles : [req.adminRole ?? (req.user as { adminRole?: string | null } | undefined)?.adminRole].filter(Boolean)) as AdminRole[];
    if (!adminRolesAllow(roles, permission)) {
      // Recette API 08/09/2026 — fiche API-SEC-05 (le refus nomme la permission manquante) puis
      // dette D-5 : il passe maintenant par le middleware d'erreur commun. Le `code` et la
      // `permission` restent servis en tête, recopiés depuis `details` par ce middleware.
      return next(
        new ForbiddenError("Your admin profile does not allow this action.", {
          code: "ADMIN_PERMISSION_DENIED",
          permission,
        })
      );
    }
    return next();
  };
