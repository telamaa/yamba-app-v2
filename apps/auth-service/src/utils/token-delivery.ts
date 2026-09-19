/**
 * token-delivery.ts — livraison des jetons de session (A201, chantier mobile D36)
 * ================================================================================
 * Le web reçoit ses jetons en COOKIES httpOnly (défaut, inchangé). Un client sans
 * magasin de cookies (l'app mobile) demande la livraison DANS LE CORPS de la
 * réponse avec l'en-tête `x-token-delivery: body` — sur opt-in explicite
 * SEULEMENT : jamais de jetons dans le corps par défaut, un XSS sur le web ne
 * doit rien pouvoir lire (les cookies restent httpOnly).
 *
 * En mode `body`, AUCUN cookie n'est posé : une session mobile vit entièrement
 * dans le stockage sécurisé du téléphone, pas à moitié dans un cookie invisible.
 */

export type TokenDelivery = "cookies" | "body";

/** TTL du jeton d'accès — UNE source pour jwt.sign et pour le client. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Lit l'en-tête `x-token-delivery`. Seule la valeur exacte `body` (casse
 *  ignorée, espaces tolérés) bascule ; tout le reste = cookies (défaut sûr). */
export function resolveTokenDelivery(headerValue: unknown): TokenDelivery {
  if (typeof headerValue !== "string") return "cookies";
  return headerValue.trim().toLowerCase() === "body" ? "body" : "cookies";
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <token>`.
 *  Renvoie undefined pour tout autre schéma ou un en-tête vide. */
export function bearerTokenOf(authorizationHeader: unknown): string | undefined {
  if (typeof authorizationHeader !== "string") return undefined;
  if (!authorizationHeader.startsWith("Bearer ")) return undefined;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

/** La forme `tokens` renvoyée dans le corps en mode body — c'est le contrat
 *  SessionTokens de l'OpenAPI (member-auth.schema.ts), jamais plus. */
export function sessionTokensBody(accessToken: string, refreshToken: string) {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
  };
}
