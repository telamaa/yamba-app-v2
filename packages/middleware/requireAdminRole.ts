/**
 * requireAdminRole — permission par route (C-PR3, D56 1A)
 * =======================================================
 * À poser APRÈS isAdminAuthenticated. La matrice vit dans le contrat
 * (`ADMIN_PERMISSIONS`) : SUPER_ADMIN passe partout, les autres profils sont
 * bornés par permission. Un refus est un 403 explicite (jamais un 404 : la
 * route existe, c'est le profil qui manque).
 */
import type { NextFunction, Response } from "express";
import { adminRoleAllows, type AdminPermission, type AdminRole } from "@packages/api-contracts";
import type { AuthenticatedRequest } from "./isAuthenticated";

export const requireAdminPermission =
  (permission: AdminPermission) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = (req.adminRole ?? (req.user as { adminRole?: string | null } | undefined)?.adminRole ?? null) as AdminRole | null;
    if (!adminRoleAllows(role, permission)) {
      return res.status(403).json({ message: "Your admin profile does not allow this action.", code: "ADMIN_PERMISSION_DENIED", permission });
    }
    return next();
  };
