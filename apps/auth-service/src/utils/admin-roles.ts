/**
 * admin-roles.ts — profils cumulés (C-PR3bis, D60 1A)
 * ====================================================
 * Un compte admin porte `adminRoles` (liste, union des permissions) ET `adminRole` (profil principal,
 * miroir du premier — lu par la connexion, l'affichage et les comptes d'avant C-PR3bis).
 * Les writers passent par `adminRolesData` : la liste n'est JAMAIS absente (pitfall Mongo des listes).
 */
import { adminRolesOf, normalizeAdminRoles, primaryAdminRole, type AdminRole } from "@packages/api-contracts";

export { adminRolesOf };

export function adminRolesData(roles: readonly AdminRole[]): { adminRoles: AdminRole[]; adminRole: AdminRole | null } {
  const list = normalizeAdminRoles(roles);
  return { adminRoles: list, adminRole: primaryAdminRole(list) };
}
export const NO_ADMIN_ROLES = { adminRoles: [] as AdminRole[], adminRole: null };

export const isSuperAdmin = (roles: readonly string[] | null | undefined) => !!roles?.includes("SUPER_ADMIN");
