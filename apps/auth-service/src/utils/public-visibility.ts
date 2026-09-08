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
 * ⚠ ANO-API-23 (08/09/2026) — CE QU'IL FAUT SAVOIR SUR LE CHAMP ABSENT, vérifié contre la base :
 *
 * 1. Un champ ABSENT du document n'est matché par AUCUN filtre Prisma — `{ not: true }` pas
 *    davantage que `false`. La version précédente affirmait le contraire en commentaire, et
 *    `GET /users/{slug}/public` répondait **404 pour 22 comptes sur 26**.
 * 2. `isSet: false`, le remède habituel du projet, n'est **PAS disponible ici** : Prisma ne
 *    l'offre que sur les champs OPTIONNELS. `isDeleted` et `profilePublic` sont requis avec un
 *    défaut — l'écrire lève `Unknown argument \`isSet\``. (C'est pour cela que `notHiddenFilter()`
 *    peut l'utiliser sur `hiddenByAdminAt`, qui est `DateTime?`.)
 *
 * Donc, pour un champ REQUIS, « absent » n'est pas exprimable dans la requête : c'est un défaut de
 * DONNÉES, pas de filtre. L'égalité simple ci-dessous est la bonne écriture, et le remède est
 * `packages/libs/prisma/scripts/repair-absent-scalars.ts` — à passer après tout ajout d'un champ
 * requis à défaut, sur les documents créés avant lui (Prisma écrit le défaut à la création, donc
 * seuls les anciens documents sont concernés).
 */

export type PublicProfileWhere = {
  publicSlug: string;
  isDeleted: false;
  OR: Array<{ profilePublic: true } | { id: string }>;
};

/**
 * Filtre d'un profil public consultable : non supprimé, et soit public,
 * soit consulté par son propriétaire. À utiliser avec `findFirst`.
 */
export function publicProfileWhere(slug: string, currentUserId: string | null): PublicProfileWhere {
  const or: PublicProfileWhere["OR"] = [{ profilePublic: true }];
  if (currentUserId) or.push({ id: currentUserId });
  return { publicSlug: slug, isDeleted: false, OR: or };
}
