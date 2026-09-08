import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { isSessionRevoked, sessionKey } from "./session-revocation";

export type AuthenticatedRequest = Request & {
  user?: any;
  roles?: string[];
};

type JwtPayload = {
  id: string;
  roles?: string[];
  /**
   * ANO-API-07 — identifiant de la session qui a émis ce jeton d'accès. Absent des jetons
   * émis avant la correction : ceux-là restent acceptés jusqu'à leur expiration (15 min),
   * le temps que le parc tourne.
   */
  jti?: string;
};

/**
 * ANO-API-07 (recette API 08/09/2026, fiches API-AUTH-11 / 12 / 13) — « couper cet appareil »,
 * « se déconnecter » et « changer de mot de passe » ne coupaient que le RAFRAÎCHISSEMENT :
 * le jeton d'accès restait accepté jusqu'à sa fin de vie. Un quart d'heure d'accès en lecture
 * conservé, précisément dans les trois gestes qu'on fait quand on se croit compromis.
 *
 * Le jeton d'accès porte donc le `jti` de sa session, et l'existence de cette session est
 * vérifiée à chaque requête. La clé Redis est la même que celle du rafraîchissement
 * (`refresh_jti:<userId>:<jti>`, posée par auth-service) : révoquer une session la supprime,
 * et l'accès tombe dans la seconde.
 *
 * Fail-open volontaire si Redis est injoignable : une panne du cache ne doit pas déconnecter
 * toute la plateforme. Le compte suspendu ou effacé, lui, est déjà refusé par la lecture Mongo
 * juste au-dessus, qui ne dépend pas de Redis.
 */
async function sessionRevoquee(userId: string, jti: string | undefined): Promise<boolean> {
  if (!jti) return false; // jeton d'avant la correction : on ne casse pas les sessions en cours
  let exists: number | null = null;
  try {
    exists = await redis.exists(sessionKey(userId, jti));
  } catch {
    exists = null; // Redis muet : la décision pure choisit de laisser passer
  }
  return isSessionRevoked(jti, exists);
}

const extractToken = (req: Request): string | null => {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;

  return req.cookies?.access_token || bearerToken || null;
};

const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized! Token missing." });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;

    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized! Invalid token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ message: "Account not found." });
    }
    // C-PR8b (D63 4A) — compte effacé : plus aucune session, plus aucun email.
    if ((user as { isDeleted?: boolean }).isDeleted) {
      return res.status(401).json({ message: "Account deleted.", code: "ACCOUNT_DELETED" });
    }
    // C-PR3 (D56 2A) — SUSPENDED : connexion refusée partout (les sessions sont révoquées à la suspension).
    if ((user as { accountStatus?: string }).accountStatus === "SUSPENDED") {
      return res.status(401).json({ message: "Account suspended.", code: "ACCOUNT_SUSPENDED" });
    }
    // ANO-API-07 — la session a-t-elle été révoquée (déconnexion, coupure d'appareil,
    // changement de mot de passe) ? L'accès tombe alors immédiatement.
    if (await sessionRevoquee(decoded.id, decoded.jti)) {
      return res.status(401).json({ message: "Session revoked.", code: "SESSION_REVOKED" });
    }

    req.user = user;
    req.roles = decoded.roles ?? user.roles ?? [];

    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized! Token expired or invalid." });
  }
};

export default isAuthenticated;
