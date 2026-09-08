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
 * le champ est ABSENT — d'où le OR de `notHiddenFilter()`. Même raison pour
 * `isDeleted: { not: true }` plutôt que `isDeleted: false`.
 */
import { notHiddenFilter } from "./admin-trips.rules";

export type PublicTripWhere = {
  id: string;
  status: "PUBLISHED";
  isDeleted: { not: true };
  AND: Array<ReturnType<typeof notHiddenFilter>>;
};

/**
 * Filtre d'un trajet consultable par n'importe qui : publié, non supprimé,
 * non masqué par la modération. À utiliser avec `findFirst` (et non `findUnique`,
 * qui n'accepte pas de critère non unique).
 */
export function publicTripWhere(id: string): PublicTripWhere {
  return { id, status: "PUBLISHED", isDeleted: { not: true }, AND: [notHiddenFilter()] };
}
