/**
 * public-visibility.rules.ts — règle PURE : ce qu'un visiteur a le droit de voir (ANO-API-02)
 * ============================================================================================
 * Recette API du 08/09/2026, fiche API-GW-18 : un trajet MASQUÉ par Yamba et un
 * trajet INEXISTANT rendaient bien le même 404 avec le même corps — mais pas dans
 * le même temps (médianes 32,8 ms contre 12,2 ms sur 25 mesures, distributions
 * disjointes). La cause n'était pas le 404 : le contrôleur chargeait le trajet ET
 * ses trois jointures, PUIS jetait le résultat. Le travail supplémentaire trahissait
 * l'existence de la ressource — de quoi énumérer ce que la modération a caché.
 *
 * La visibilité descend donc dans la REQUÊTE : un trajet invisible n'est pas trouvé,
 * exactement comme un trajet inexistant, et personne ne paie de jointure pour rien.
 *
 * Piège maison Prisma + Mongo : `hiddenByAdminAt: null` ne matche PAS un document où
 * le champ est ABSENT — d'où le OR de `notHiddenFilter()`.
 *
 * ⚠ ANO-API-23 (08/09/2026) — CE QU'IL FAUT SAVOIR, vérifié contre la base :
 *
 * 1. La version précédente ajoutait « même raison pour `isDeleted: { not: true }` plutôt que
 *    `isDeleted: false` ». **C'était faux** : `not` ne matche pas davantage un champ absent.
 *    `GET /trips/{id}/public` répondait **404 pour 24 trajets publiés sur 37**.
 * 2. `isSet: false` n'est **pas disponible** sur `isDeleted` : Prisma ne l'offre que sur les
 *    champs OPTIONNELS, et `isDeleted` est requis avec un défaut. C'est précisément pourquoi
 *    `notHiddenFilter()` peut l'utiliser sur `hiddenByAdminAt`, qui est `DateTime?`.
 *
 * Pour un champ REQUIS, « absent » n'est donc pas exprimable dans la requête : c'est un défaut de
 * DONNÉES. L'égalité simple est la bonne écriture, et le remède est
 * `packages/libs/prisma/scripts/repair-absent-scalars.ts`.
 */
import { notHiddenFilter } from "./admin-trips.rules";

export type PublicTripWhere = {
  id: string;
  status: "PUBLISHED";
  isDeleted: false;
  AND: Array<ReturnType<typeof notHiddenFilter>>;
};

/**
 * Filtre d'un trajet consultable par n'importe qui : publié, non supprimé,
 * non masqué par la modération. À utiliser avec `findFirst` (et non `findUnique`,
 * qui n'accepte pas de critère non unique).
 */
export function publicTripWhere(id: string): PublicTripWhere {
  return { id, status: "PUBLISHED", isDeleted: false, AND: [notHiddenFilter()] };
}
