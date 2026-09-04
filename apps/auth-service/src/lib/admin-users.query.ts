/**
 * admin-users.query.ts — recherche poussée des utilisateurs, PURE (C-PR7a, D60 2A)
 * ================================================================================
 * Traduit la requête validée en `where` / `orderBy` Prisma. Testé sans base.
 */
import type { AdminUsersQuery } from "@packages/api-contracts";

export const OID = /^[a-f0-9]{24}$/i;
export const TICKET = /^YAM-\d{4,6}$/i;

export function buildUsersWhere(q: AdminUsersQuery): Record<string, unknown> {
  const where: Record<string, unknown> = { isDeleted: false };
  if (q.role) where.roles = { has: q.role };
  if (q.accountStatus) where.accountStatus = q.accountStatus;
  if (q.carrierStatus) where.carrierStatus = q.carrierStatus;
  if (q.stripeReady === "1") where.carrierPage = { is: { stripePayoutsEnabled: true } };
  if (q.stripeReady === "0") where.OR = [{ carrierPage: null }, { carrierPage: { is: { stripePayoutsEnabled: false } } }];
  if (q.createdFrom || q.createdTo) where.createdAt = { ...(q.createdFrom ? { gte: new Date(q.createdFrom) } : {}), ...(q.createdTo ? { lt: new Date(q.createdTo) } : {}) };
  const term = (q.q ?? "").trim();
  if (term && !OID.test(term) && !TICKET.test(term)) {
    const digits = term.replace(/[^\d+]/g, "");
    const or: Record<string, unknown>[] = [
      { emailNormalized: { contains: term.toLowerCase() } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      ...(digits.length >= 6 ? [{ phoneE164: { contains: digits } }] : []),
    ];
    // Un OR existe déjà (stripeReady=0) : on combine par AND
    if (where.OR) { where.AND = [{ OR: where.OR }, { OR: or }]; delete where.OR; } else where.OR = or;
  }
  return where;
}

export function buildUsersOrderBy(q: AdminUsersQuery): Array<Record<string, "asc" | "desc">> {
  return [{ [q.sort]: q.dir }, { id: q.dir }]; // l'id en second : curseur stable
}

/** Colonnes de l'export (données personnelles : SUPER_ADMIN seul, motif au journal). */
export const USERS_CSV_COLUMNS = ["id", "firstName", "lastName", "email", "phoneE164", "roles", "adminRoles", "accountStatus", "carrierStatus", "stripeReady", "suspendedAt", "suspensionUntil", "createdAt"] as const;
