/** Miroir de ADMIN_PERMISSIONS (packages/libs/api-contracts/src/admin/admin-users.schema.ts) — SUPER_ADMIN passe partout. */
export type AdminRole = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE";
export type AdminPermission =
  | "disputes.read" | "disputes.decide" | "users.read" | "users.suspension.propose" | "users.suspension.apply" | "audit.read" | "admins.manage"
  | "trips.read" | "tickets.review" | "trips.hide.propose" | "trips.hide.apply" | "kpi.read"
  | "finances.read" | "payouts.retry" | "payouts.resolve" | "finances.export" | "refunds.manual.propose" | "refunds.manual.apply"
  | "pilotage.read" | "deals.history.read";

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
  "kpi.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "finances.read": ["FINANCE", "MEDIATOR"],
  "payouts.retry": ["FINANCE", "MEDIATOR"],
  "payouts.resolve": ["FINANCE", "MEDIATOR"],
  "finances.export": ["FINANCE"],
  "refunds.manual.propose": ["FINANCE", "SUPPORT"],
  "refunds.manual.apply": [],
  "pilotage.read": ["FINANCE", "MEDIATOR"],
  "deals.history.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
};

export function can(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return MATRIX[permission].includes(role);
}

export const ROLE_LABEL: Record<AdminRole, string> = { SUPER_ADMIN: "Super administrateur", MEDIATOR: "Médiateur", SUPPORT: "Support", FINANCE: "Finance" };
