/**
 * rate-limit-tier.ts — quel plafond de requêtes pour cet appelant ? (A147)
 * =========================================================================
 * Le limiteur du gateway lisait `req.user`, que RIEN ne pose au gateway : aucune
 * authentification n'y tourne, le proxy transmet la requête telle quelle. Résultat,
 * la branche « membre connecté » était morte et tout le monde subissait le plafond
 * anonyme (100 requêtes par quart d'heure) — une navigation normale l'atteint.
 *
 * Ici on ne fait pas confiance à la présence d'un cookie (elle se falsifie) : on
 * VÉRIFIE la signature du jeton, ce qui coûte une empreinte HMAC et ne se contrefait
 * pas. Le gateway a déjà le secret. Fonctions pures, vérificateur injecté.
 */
export const RATE_LIMIT_ANONYMOUS = 100;
export const RATE_LIMIT_AUTHENTICATED = 1_000;

export type RateLimits = { anonymous: number; authenticated: number };
export const DEFAULT_RATE_LIMITS: RateLimits = { anonymous: RATE_LIMIT_ANONYMOUS, authenticated: RATE_LIMIT_AUTHENTICATED };

/**
 * Les plafonds, surchargeables par l'environnement (`RATE_LIMIT_ANONYMOUS_MAX`,
 * `RATE_LIMIT_AUTHENTICATED_MAX`) : un poste de recette qui rejoue trois parcours par quart
 * d'heure épuise les 100 requêtes anonymes avec ses seuls visiteurs (page trajet, porte de
 * réservation, suivi destinataire, profil public) — mesuré le 09/09/2026. La production garde
 * les défauts ; une valeur absente, vide ou non entière strictement positive est ignorée.
 */
export function resolveRateLimits(env: Record<string, string | undefined> = process.env): RateLimits {
  const lire = (nom: string, defaut: number): number => {
    const brut = env[nom]?.trim();
    if (!brut || !/^\d+$/.test(brut)) return defaut;
    const n = Number(brut);
    return n > 0 ? n : defaut;
  };
  return { anonymous: lire("RATE_LIMIT_ANONYMOUS_MAX", RATE_LIMIT_ANONYMOUS), authenticated: lire("RATE_LIMIT_AUTHENTICATED_MAX", RATE_LIMIT_AUTHENTICATED) };
}

export type RateLimitedRequest = {
  cookies?: Record<string, unknown>;
  headers?: Record<string, unknown>;
};

/** Le jeton de session porté par la requête : cookie membre, cookie admin, puis Bearer. */
export function extractSessionToken(req: RateLimitedRequest): string | null {
  const cookies = req.cookies ?? {};
  const member = cookies["access_token"];
  if (typeof member === "string" && member) return member;
  const admin = cookies["admin_access_token"];
  if (typeof admin === "string" && admin) return admin;
  const auth = req.headers?.["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer) return bearer;
  }
  return null;
}

/**
 * Le plafond applicable. `verify` rend `true` quand la signature du jeton est valide
 * (un jeton expiré ou forgé retombe donc sur le plafond anonyme).
 */
export function rateLimitMax(req: RateLimitedRequest, verify: (token: string) => boolean, limits: RateLimits = DEFAULT_RATE_LIMITS): number {
  const token = extractSessionToken(req);
  if (!token) return limits.anonymous;
  return verify(token) ? limits.authenticated : limits.anonymous;
}
