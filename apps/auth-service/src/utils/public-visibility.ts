/**
 * public-visibility.ts — règle PURE : quel profil public un visiteur peut charger (ANO-API-02)
 * =============================================================================================
 * Pendant de `apps/trip-service/src/lib/public-visibility.rules.ts`. Même constat en
 * recette API (fiche API-GW-18) : un profil EXISTANT mais privé et un slug INEXISTANT
 * rendaient le même 404 avec le même corps, mais en 26,5 ms contre 11,3 ms (25 mesures,
 * distributions disjointes) — le profil privé payait ses jointures avant d'être jeté.
 * La visibilité descend donc dans la requête.
 *
 * L'exception D67 1A est conservée : le PROPRIÉTAIRE connecté voit son propre profil
 * même masqué (le front l'affiche marqué « masqué »). Elle entre dans le `OR`.
 *
 * Pièges Mongo : `isDeleted: { not: true }` et `profilePublic: { not: false }` plutôt
 * qu'une égalité, pour matcher aussi les documents où le champ est ABSENT.
 */

export type PublicProfileWhere = {
  publicSlug: string;
  isDeleted: { not: true };
  OR: Array<{ profilePublic: { not: false } } | { id: string }>;
};

/**
 * Filtre d'un profil public consultable : non supprimé, et soit public,
 * soit consulté par son propriétaire. À utiliser avec `findFirst`.
 */
export function publicProfileWhere(slug: string, currentUserId: string | null): PublicProfileWhere {
  const or: PublicProfileWhere["OR"] = [{ profilePublic: { not: false } }];
  if (currentUserId) or.push({ id: currentUserId });
  return { publicSlug: slug, isDeleted: { not: true }, OR: or };
}
