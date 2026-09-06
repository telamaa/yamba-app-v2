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
export function rateLimitMax(req: RateLimitedRequest, verify: (token: string) => boolean): number {
  const token = extractSessionToken(req);
  if (!token) return RATE_LIMIT_ANONYMOUS;
  return verify(token) ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
}
