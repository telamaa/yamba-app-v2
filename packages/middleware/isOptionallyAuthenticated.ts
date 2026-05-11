import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import type { AuthenticatedRequest } from "./isAuthenticated";

type JwtPayload = {
  id: string;
  roles?: string[];
};

const extractToken = (req: Request): string | null => {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
  return req.cookies?.access_token || bearerToken || null;
};

/**
 * Middleware d'auth optionnelle.
 *
 * Comportement :
 *   - Pas de token → continue, req.user reste undefined
 *   - Token valide → comportement identique à isAuthenticated
 *     (req.user = user complet depuis DB, req.roles = roles)
 *   - Token invalide/expiré → continue silencieusement, req.user reste undefined
 *     (volontaire : un token expiré ne doit pas casser un endpoint public)
 *
 * À utiliser pour les endpoints publics qui bénéficient d'une personnalisation
 * quand l'user est connecté.
 *
 * Exemples :
 *   - GET /users/:slug/public → isFollowedByMe, isOwnProfile
 *   - GET /trips/:id/public → bookmarkedByMe (futur)
 */
const isOptionallyAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractToken(req);

  // Pas de token → endpoint reste accessible mais sans personnalisation
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;

    if (!decoded?.id) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (user) {
      req.user = user;
      req.roles = decoded.roles ?? user.roles ?? [];
    }
  } catch {
    // Token invalide/expiré → on continue, l'endpoint répondra en mode "non connecté"
  }

  return next();
};

export default isOptionallyAuthenticated;
