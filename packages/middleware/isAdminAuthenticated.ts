/**
 * isAdminAuthenticated — garde des routes /admin/* (D54, 8A)
 *
 * Dettes D-4 / D-5 (recette API 08/09/2026) : ses quatre refus n'avaient AUCUN code et
 * écrivaient leur réponse eux-mêmes. Ils passent maintenant par `next()`, donc par le middleware
 * d'erreur commun, avec un code chacun — l'admin-ui peut distinguer « pas de jeton admin » d'une
 * « session sans 2FA » et d'un « compte qui n'est plus administrateur ».
 * ==========================================================
 * Lit UNIQUEMENT le cookie `admin_access_token` (ou un Bearer), jamais
 * `access_token` : une session utilisateur, même d'un compte ADMIN, n'ouvre
 * aucune route admin. Exige dans le JWT `adm: true` + `amr` contenant "totp",
 * et en base : compte ADMIN, non supprimé, 2FA active.
 */
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { AuthError, ForbiddenError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "./isAuthenticated";
import { adminSessionKey, isAdminSessionRevoked } from "./session-revocation";

declare module "express-serve-static-core" {
  interface Request {
    adminRole?: string | null;
    /** C-PR3bis (D60 1A) — profils cumulés (liste absente sur les anciens comptes → [adminRole]) */
    adminRoles?: string[];
  }
}

/** `jti` (ANO-ADM-04) : la session admin qui a émis ce jeton — absent des jetons d'avant la correction. */
type AdminJwtPayload = { id: string; roles?: string[]; adm?: boolean; amr?: string[]; jti?: string };

/**
 * ANO-ADM-04 — la session existe-t-elle encore en Redis ? « Révoquer » (page Sessions) et
 * « Se déconnecter » la suppriment : l'accès tombe dans la seconde, pas au bout des 15 minutes
 * du jeton. Échec FERMÉ si Redis est muet (voir `isAdminSessionRevoked`).
 */
async function sessionAdminRevoquee(userId: string, jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  let exists: number | null = null;
  try {
    exists = await redis.exists(adminSessionKey(userId, jti));
  } catch {
    exists = null;
  }
  return isAdminSessionRevoked(jti, exists);
}

const extractToken = (req: Request): string | null => {
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null;
  return req.cookies?.admin_access_token || bearer || null;
};

const isAdminAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) return next(new AuthError("Unauthorized! Admin token missing.", { code: "ADMIN_TOKEN_MISSING" }));
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as AdminJwtPayload;
    if (!decoded?.id || decoded.adm !== true || !decoded.amr?.includes("totp")) {
      return next(new AuthError("Unauthorized! Admin session required.", { code: "ADMIN_SESSION_REQUIRED" }));
    }
    if (await sessionAdminRevoquee(decoded.id, decoded.jti)) {
      return next(new AuthError("Admin session revoked.", { code: "ADMIN_SESSION_REVOKED" }));
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isDeleted || !user.roles.includes("ADMIN") || !user.totpEnabledAt) {
      return next(new ForbiddenError("Access denied.", { code: "NOT_AN_ADMIN" }));
    }
    req.user = user;
    req.roles = user.roles;
    // C-PR3 (D56) — le profil admin voyage avec la requête ; requireAdminRole le lit.
    const u = user as { adminRole?: string | null; adminRoles?: string[] | null };
    req.adminRoles = u.adminRoles && u.adminRoles.length ? u.adminRoles : u.adminRole ? [u.adminRole] : [];
    req.adminRole = u.adminRole ?? req.adminRoles[0] ?? null;
    return next();
  } catch {
    return next(new AuthError("Unauthorized! Admin token expired or invalid.", { code: "ADMIN_TOKEN_EXPIRED" }));
  }
};

export default isAdminAuthenticated;
