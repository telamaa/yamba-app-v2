/**
 * admin-users.query.ts — recherche poussée des utilisateurs, PURE (C-PR7a, D60 2A)
 * ================================================================================
 * Traduit la requête validée en `where` / `orderBy` Prisma. Testé sans base.
 */
import type { AdminUsersQuery } from "@packages/api-contracts";

export const OID = /^[a-f0-9]{24}$/i;
export const TICKET = /^YAM-\d{4,6}$/i;

/**
 * ANO-ADM-05 (recette 02-ADMIN § 5.3) — sur MongoDB, Prisma traduit `contains` en `$regex` SANS échapper le terme :
 * « +33612345601 » devenait une expression dont le `+` initial est un quantificateur (zéro résultat), un « . » d'email
 * valait « n'importe quel caractère », une « ( » faisait échouer la requête. Tout terme libre passe par ici.
 */
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Le numéro cherché, réduit à ses chiffres significatifs pour un `contains` sur `phoneE164` : sans « + », sans préfixe
 * international « 00 », sans « 0 » national — « +33 6 12 34 56 01 », « 0033612345601 » et « 06 12 34 56 01 » trouvent
 * tous « +33612345601 ». `null` sous 6 caractères de numéro (règle C-PR7a inchangée).
 */
export function phoneNeedle(term: string): string | null {
  const digits = term.replace(/[^\d+]/g, "");
  if (digits.length < 6) return null;
  const bare = digits.replace(/\+/g, "");
  if (bare.startsWith("00")) return bare.slice(2);
  if (bare.startsWith("0")) return bare.slice(1);
  return bare;
}

/** Par quel indice un compte a été trouvé (« via … » à l'écran) — même ordre que l'écran le lit : email, téléphone, nom. */
export function matchedOnFor(row: { email: string; phoneE164: string | null }, term: string): "email" | "phone" | "name" {
  if (row.email.toLowerCase().includes(term.toLowerCase())) return "email";
  const needle = phoneNeedle(term);
  if (needle && (row.phoneE164 ?? "").includes(needle)) return "phone";
  return "name";
}

/** Le OR textuel commun aux deux recherches. */
export function textSearchOr(term: string): Record<string, unknown>[] {
  const pattern = escapeRegex(term);
  const needle = phoneNeedle(term);
  return [
    { emailNormalized: { contains: pattern.toLowerCase() } },
    { firstName: { contains: pattern, mode: "insensitive" } },
    { lastName: { contains: pattern, mode: "insensitive" } },
    ...(needle ? [{ phoneE164: { contains: needle } }] : []),
  ];
}

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
    const or = textSearchOr(term);
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
