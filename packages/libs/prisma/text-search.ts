/**
 * text-search.ts — un terme saisi n'est jamais une expression régulière (ANO-ADM-05, ANO-ADM-15)
 * ===============================================================================================
 * Sur MongoDB, Prisma traduit `contains`, `startsWith`, `endsWith` et `equals` + `mode: "insensitive"` en `$regex`
 * SANS échapper la valeur. Mesuré (recette 02-ADMIN § 5.7, 14/09/2026) :
 *
 *   { originCity: { contains: "(" } }                        → la requête échoue : 500 sur la recherche publique
 *   { originCity: { contains: "." } }                        → 41 trajets sur 41 (« n'importe quel caractère »)
 *   { originCity: { equals: "P.ris", mode: "insensitive" } } → 20 trajets « Paris »
 *   { originCity: { contains: "\\." } }                      → 0 (le terme échappé est pris à la lettre)
 *
 * Une regex fournie par un visiteur est aussi une porte ouverte au retour arrière catastrophique (« (a+)+$ ») sur la
 * base partagée. Né dans auth-service au § 5.3 (`admin-users.query.ts`), remonté ici au § 5.7 : TOUT filtre textuel
 * sur une saisie passe par ces fonctions. Aucune dépendance : importable par les services, les seeds et les tests.
 */

/** Échappe les métacaractères d'expression régulière : le terme est cherché à la lettre. */
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Filtre Prisma « contient ce texte, sans casse », sûr. */
export function containsText(term: string): { contains: string; mode: "insensitive" } {
  return { contains: escapeRegex(term), mode: "insensitive" };
}

/** Filtre Prisma « égal à ce texte, sans casse », sûr (Prisma l'ancre en `^…$`). */
export function equalsText(term: string): { equals: string; mode: "insensitive" } {
  return { equals: escapeRegex(term), mode: "insensitive" };
}
