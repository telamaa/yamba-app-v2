/**
 * search-facets.ts — comment se lit un compteur de facette à ZÉRO (D100 5A)
 * =========================================================================
 * Une facette de recherche (mode de transport, famille de colis…) porte le
 * nombre de trajets qu'elle rendrait. Quand ce nombre vaut zéro, trois
 * traitements coexistaient dans le produit au 14/11/2026 :
 *
 *   • téléphone, onglets de mode — estompé à 50 %, TOUJOURS tapable ;
 *   • site, familles — `disabled`, grisé, curseur barré ;
 *   • site, onglets de mode — RIEN : poids plein, cliquable, menant au vide.
 *
 * La règle du téléphone est retenue, et pour une raison précise : une facette
 * à zéro reste **le chemin de sortie** d'un filtre qui ne rend rien. La
 * désactiver enferme — l'Expéditeur qui a cliqué « Train 0 » doit pouvoir
 * revenir, et c'est le même geste. L'estompe dit « il n'y a rien par là »
 * sans retirer la porte.
 *
 * Une facette ACTIVE échappe à la règle même à zéro : c'est elle qu'on vient
 * de choisir, et l'effacer de l'œil au moment où elle est sélectionnée rendrait
 * l'état de l'écran illisible.
 *
 * ⚠️ Ce fichier est DUPLIQUÉ à l'identique dans `apps/user-ui/src/lib/` et une
 * fiche compare les deux copies À L'OCTET PRÈS. La duplication est voulue : le
 * téléphone ne doit pas tirer de code du site (un `import` par-dessus la
 * frontière des projets est une dépendance de BUILD — cf. D93). Le site, lui,
 * n'a pas de harnais de tests : c'est cette comparaison qui le couvre.
 */

/** L'opacité d'une facette sans résultat. Assez effacée pour se taire, assez
 *  présente pour rester une porte. */
export const EMPTY_FACET_OPACITY = 0.5;

/** Cette facette doit-elle s'effacer ? Jamais celle qui est active. */
export function isEmptyFacet(count: number | null | undefined, active: boolean): boolean {
  return !active && typeof count === 'number' && count === 0;
}
