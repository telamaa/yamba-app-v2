/** Miroir de ADMIN_PERMISSIONS (packages/libs/api-contracts/src/admin/admin-users.schema.ts) — SUPER_ADMIN passe partout. */
export type AdminRole = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE";
export type AdminPermission = "disputes.read" | "disputes.decide" | "users.read" | "users.suspension.propose" | "users.suspension.apply" | "audit.read" | "admins.manage";

const MATRIX: Record<AdminPermission, AdminRole[]> = {
  "disputes.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "disputes.decide": ["MEDIATOR"],
  "users.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "users.suspension.propose": ["SUPPORT", "MEDIATOR"],
  "users.suspension.apply": ["MEDIATOR"],
  "audit.read": ["FINANCE"],
  "admins.manage": [],
};

export function can(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return MATRIX[permission].includes(role);
}

export const ROLE_LABEL: Record<AdminRole, string> = { SUPER_ADMIN: "Super administrateur", MEDIATOR: "Médiateur", SUPPORT: "Support", FINANCE: "Finance" };
