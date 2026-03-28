import { AuthError } from "@packages/error-handler";
import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./isAuthenticated";

type AllowedRole = "USER" | "ADMIN";

export const authorizeRoles =
  (...allowedRoles: AllowedRole[]) =>
    (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const roles = req.roles ?? req.user?.roles ?? [];

      const hasAccess = allowedRoles.some((role) => roles.includes(role));

      if (!hasAccess) {
        return next(new AuthError("Access denied."));
      }

      return next();
    };

export const isUser = authorizeRoles("USER");
export const isAdmin = authorizeRoles("ADMIN");
