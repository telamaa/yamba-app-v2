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

/**
 * Dette D-4 de la recette API (08/09/2026) — ce middleware écrit sa réponse lui-même, sans passer
 * par le middleware d'erreur : trois de ses refus portaient un `code` au premier niveau, les
 * quatre autres **rien du tout** — dont « jeton absent », le 401 le plus fréquent de la plateforme.
 *
 * Les deux formes coexistent maintenant : `code` en tête (le front le lit déjà) et `details.code`
 * (la règle générale). Sept refus, sept codes distincts : un client doit pouvoir distinguer
 * « pas de jeton » (se connecter) de « session révoquée » (on vous a déconnecté) de « compte
 * suspendu » (contacter le support).
 */
function refus(res: Response, message: string, code: string) {
  return res.status(401).json({ message, code, details: { code } });
}

const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return refus(res, "Unauthorized! Token missing.", "TOKEN_MISSING");
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;

    if (!decoded?.id) {
      return refus(res, "Unauthorized! Invalid token.", "TOKEN_INVALID");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return refus(res, "Account not found.", "USER_NOT_FOUND");
    }
    // C-PR8b (D63 4A) — compte effacé : plus aucune session, plus aucun email.
    if ((user as { isDeleted?: boolean }).isDeleted) {
      return refus(res, "Account deleted.", "ACCOUNT_DELETED");
    }
    // C-PR3 (D56 2A) — SUSPENDED : connexion refusée partout (les sessions sont révoquées à la suspension).
    if ((user as { accountStatus?: string }).accountStatus === "SUSPENDED") {
      return refus(res, "Account suspended.", "ACCOUNT_SUSPENDED");
    }
    // ANO-API-07 — la session a-t-elle été révoquée (déconnexion, coupure d'appareil,
    // changement de mot de passe) ? L'accès tombe alors immédiatement.
    if (await sessionRevoquee(decoded.id, decoded.jti)) {
      return refus(res, "Session revoked.", "SESSION_REVOKED");
    }

    req.user = user;
    req.roles = decoded.roles ?? user.roles ?? [];

    return next();
  } catch (error) {
    return refus(res, "Unauthorized! Token expired or invalid.", "TOKEN_EXPIRED");
  }
};

export default isAuthenticated;
