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

/**
 * ANO-ADM-04 (recette 02-ADMIN § 4.2, fiche ADM-SEC-10) — le même défaut existait côté
 * back-office : « Révoquer » une session admin ne coupait que le rafraîchissement, le jeton
 * d'accès restait accepté jusqu'à 15 minutes. Clé posée par auth-service (`admin-session.ts`),
 * qui l'importe d'ici : une seule écriture, aucune divergence possible.
 */
export const adminSessionKey = (userId: string, jti: string): string => `admin_jti:${userId}:${jti}`;

/**
 * Même décision que `isSessionRevoked`, À UNE EXCEPTION PRÈS : Redis injoignable → REFUS.
 * Le back-office compte une poignée de comptes à fort pouvoir, son rafraîchissement dépend
 * déjà de Redis, et une panne du cache n'y déconnecte personne de la plateforme membre :
 * l'échec fermé coûte peu, l'échec ouvert laisserait passer une session révoquée.
 */
export function isAdminSessionRevoked(jti: string | undefined | null, exists: number | null): boolean {
  if (!jti) return false;
  if (exists === null) return true;
  return exists === 0;
}
