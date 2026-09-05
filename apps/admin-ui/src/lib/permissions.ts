/** Miroir de ADMIN_PERMISSIONS (packages/libs/api-contracts/src/admin/admin-users.schema.ts) — SUPER_ADMIN passe partout. */
export type AdminRole = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE" | "OPS" | "PRIVACY";
export type AdminPermission =
  | "disputes.read" | "disputes.decide" | "users.read" | "users.suspension.propose" | "users.suspension.apply" | "audit.read" | "admins.manage"
  | "trips.read" | "tickets.review" | "trips.hide.propose" | "trips.hide.apply" | "kpi.read"
  | "finances.read" | "payouts.retry" | "payouts.resolve" | "finances.export" | "refunds.manual.propose" | "refunds.manual.apply"
  | "pilotage.read" | "deals.history.read" | "exports.operational" | "exports.personal"
  | "conversations.read" | "reports.review"
  | "settings.read" | "settings.business.write" | "settings.operations.write"
  | "privacy.requests.read" | "users.erase"
  | "status.read" | "maintenance.write" | "users.email.unsuppress";

const MATRIX: Record<AdminPermission, AdminRole[]> = {
  "disputes.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "disputes.decide": ["MEDIATOR"],
  "users.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "users.suspension.propose": ["SUPPORT", "MEDIATOR"],
  "users.suspension.apply": ["MEDIATOR"],
  "audit.read": ["FINANCE"],
  "admins.manage": [],
  "trips.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "tickets.review": ["SUPPORT", "MEDIATOR"],
  "trips.hide.propose": ["SUPPORT", "MEDIATOR"],
  "trips.hide.apply": ["MEDIATOR"],
  "kpi.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS"],
  "finances.read": ["FINANCE", "MEDIATOR"],
  "payouts.retry": ["FINANCE", "MEDIATOR"],
  "payouts.resolve": ["FINANCE", "MEDIATOR"],
  "finances.export": ["FINANCE"],
  "refunds.manual.propose": ["FINANCE", "SUPPORT"],
  "refunds.manual.apply": [],
  "pilotage.read": ["FINANCE", "MEDIATOR"],
  "deals.history.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "exports.operational": ["FINANCE", "MEDIATOR"],
  "exports.personal": ["PRIVACY"],
  "conversations.read": ["MEDIATOR", "SUPPORT"],
  "reports.review": ["MEDIATOR", "SUPPORT"],
  // C-PR8a (D62 3A)
  "settings.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS"],
  "settings.business.write": [],
  "settings.operations.write": ["OPS"],
  // C-PR8b (D63 6A)
  "privacy.requests.read": ["PRIVACY"],
  "users.erase": ["PRIVACY"],
  // C-PR8c (D64)
  "status.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS", "PRIVACY"],
  "maintenance.write": ["OPS"],
  "users.email.unsuppress": ["SUPPORT", "MEDIATOR", "PRIVACY"],
};

/** C-PR3bis (D60 1A) — profils cumulés : l'UN des profils suffit ; accepte encore un profil seul (anciens écrans). */
export function can(roles: readonly AdminRole[] | AdminRole | null | undefined, permission: AdminPermission): boolean {
  const list = !roles ? [] : Array.isArray(roles) ? roles : [roles as AdminRole];
  return list.some((role) => role === "SUPER_ADMIN" || MATRIX[permission].includes(role));
}
export const isSuperAdmin = (roles: readonly AdminRole[] | AdminRole | null | undefined): boolean => can(roles, "admins.manage");
export const ADMIN_ROLES: AdminRole[] = ["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE", "OPS", "PRIVACY"];
export const rolesLabel = (roles: readonly AdminRole[] | null | undefined): string => (roles && roles.length ? roles.map((r) => ROLE_LABEL[r]).join(" + ") : "—");

export const ROLE_LABEL: Record<AdminRole, string> = { SUPER_ADMIN: "Super administrateur", MEDIATOR: "Médiateur", SUPPORT: "Support", FINANCE: "Finance", OPS: "Exploitation", PRIVACY: "Données personnelles" };
