/**
 * isAdminAuthenticated — garde des routes /admin/* (D54, 8A)
 * ==========================================================
 * Lit UNIQUEMENT le cookie `admin_access_token` (ou un Bearer), jamais
 * `access_token` : une session utilisateur, même d'un compte ADMIN, n'ouvre
 * aucune route admin. Exige dans le JWT `adm: true` + `amr` contenant "totp",
 * et en base : compte ADMIN, non supprimé, 2FA active.
 */
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import type { AuthenticatedRequest } from "./isAuthenticated";

declare module "express-serve-static-core" {
  interface Request {
    adminRole?: string | null;
  }
}

type AdminJwtPayload = { id: string; roles?: string[]; adm?: boolean; amr?: string[] };

const extractToken = (req: Request): string | null => {
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null;
  return req.cookies?.admin_access_token || bearer || null;
};

const isAdminAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "Unauthorized! Admin token missing." });
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as AdminJwtPayload;
    if (!decoded?.id || decoded.adm !== true || !decoded.amr?.includes("totp")) {
      return res.status(401).json({ message: "Unauthorized! Admin session required." });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isDeleted || !user.roles.includes("ADMIN") || !user.totpEnabledAt) {
      return res.status(403).json({ message: "Access denied." });
    }
    req.user = user;
    req.roles = user.roles;
    // C-PR3 (D56) — le profil admin voyage avec la requête ; requireAdminRole le lit.
    req.adminRole = (user as { adminRole?: string | null }).adminRole ?? null;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized! Admin token expired or invalid." });
  }
};

export default isAdminAuthenticated;
