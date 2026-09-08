/**
 * session-revocation.ts — la décision PURE « cette session vaut-elle encore ? » (ANO-API-07)
 * ==========================================================================================
 * Recette API du 08/09/2026, fiches API-AUTH-11 / 12 / 13. « Couper cet appareil »,
 * « se déconnecter » et « changer de mot de passe » ne révoquaient que le rafraîchissement :
 * le jeton d'accès restait accepté jusqu'à sa fin de vie, soit un quart d'heure d'accès en
 * lecture conservé — précisément dans les trois gestes qu'on fait quand on se croit compromis.
 *
 * Le jeton d'accès porte désormais le `jti` de sa session, et le middleware vérifie que la
 * clé de session existe toujours. La logique de décision vit ici, sans Redis, pour être
 * testable telle quelle — même découpage que `rate-limit-tier.ts`.
 */

/** La clé posée par auth-service à la connexion et à chaque rotation. */
export const sessionKey = (userId: string, jti: string): string => `refresh_jti:${userId}:${jti}`;

/**
 * Décide à partir du `jti` du jeton et du nombre de clés trouvées en Redis.
 *
 * - **Pas de `jti`** → jeton émis avant la correction : accepté, il expire de lui-même en
 *   15 minutes. Refuser ici déconnecterait tout le parc au déploiement.
 * - **`exists === 0`** → la session a été révoquée (ou a expiré) : refus immédiat.
 * - **`exists === null`** → Redis injoignable : on laisse passer. Une panne du cache ne doit
 *   pas déconnecter la plateforme entière ; le compte suspendu ou effacé reste refusé par la
 *   lecture Mongo du middleware, qui ne dépend pas de Redis.
 */
export function isSessionRevoked(jti: string | undefined | null, exists: number | null): boolean {
  if (!jti) return false;
  if (exists === null) return false;
  return exists === 0;
}
