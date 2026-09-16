/**
 * admin-audit.query.ts — filtres du journal d'audit (A149)
 * =========================================================
 * Le journal ne se lisait que du plus récent au plus ancien, page par page : retrouver
 * « qui a touché à ce compte le 12 » demandait de dérouler des centaines de lignes.
 * Les filtres portent sur ce que Mongo sait indexer (`createdAt`, `adminUserId`,
 * `targetType` + `targetId`, `action`) ; la recherche libre dans le détail reste côté
 * navigateur, sur les lignes chargées, et l'écran le dit.
 *
 * Fonction pure : le contrôleur ne fait que passer `req.query`.
 */
export type AuditQueryInput = {
  from?: string;
  to?: string;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
};

const OID = /^[a-f0-9]{24}$/;
/**
 * ANO-ADM-74 (recette 02-ADMIN § 5.24) — l'identifiant d'une cible n'est pas toujours un ObjectId : une clé de paramètre
 * (`pricing.commissionPct`), `maintenance`, l'identifiant d'une session admin (32 hex). Le filtre exigeait un ObjectId et
 * IGNORAIT le reste : cliquer « Paramètres · pricing.commissionPct » rendait toutes les lignes SETTINGS. Jeu de caractères
 * sûr, borné (pas d'opérateur, pas d'espace).
 */
const TARGET_ID = /^[A-Za-z0-9._:-]{1,100}$/;
const isDate = (v: string) => !Number.isNaN(Date.parse(v));

/** Le `where` Prisma correspondant. Une valeur vide ou mal formée est ignorée, jamais une erreur. */
export function buildAuditWhere(q: AuditQueryInput): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const createdAt: Record<string, Date> = {};
  if (q.from && isDate(q.from)) createdAt.gte = new Date(q.from);
  if (q.to && isDate(q.to)) {
    // « jusqu'au 12 » inclut le 12 en entier quand la borne est une date seule.
    const to = new Date(q.to);
    createdAt.lte = /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? new Date(to.getTime() + 86_399_999) : to;
  }
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  if (q.adminUserId && OID.test(q.adminUserId)) where.adminUserId = q.adminUserId;
  if (q.action && /^[A-Z_]{3,60}$/.test(q.action)) where.action = q.action;
  if (q.targetType && /^[A-Z_]{3,30}$/.test(q.targetType)) where.targetType = q.targetType;
  if (q.targetId && TARGET_ID.test(q.targetId.trim())) where.targetId = q.targetId.trim();
  if (q.ip && q.ip.trim()) where.ip = q.ip.trim();
  return where;
}

/** Les filtres réellement appliqués, renvoyés à l'écran pour qu'il n'affiche pas un filtre ignoré. */
export function appliedAuditFilters(q: AuditQueryInput): string[] {
  const where = buildAuditWhere(q);
  return Object.keys(where);
}

/* ── Recette § 5.25, lots du § 5.24 (A187) ─────────────────────────────────────────────────────── */

/** Les filtres d'une requête, lus tels que l'écran les envoie (une valeur non chaîne est ignorée). */
export function auditQueryFrom(query: Record<string, unknown>): AuditQueryInput {
  const s = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : undefined);
  return { from: s("from"), to: s("to"), adminUserId: s("adminUserId"), action: s("action"), targetType: s("targetType"), targetId: s("targetId"), ip: s("ip") };
}

/** Les seuls filtres RETENUS, avec leur valeur — écrits au journal de l'export (jamais une valeur ignorée). */
export function appliedAuditFilterValues(q: AuditQueryInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of appliedAuditFilters(q)) {
    if (k === "createdAt") {
      if (q.from) out.from = q.from;
      if (q.to) out.to = q.to;
    } else out[k] = String((q as Record<string, string | undefined>)[k] ?? "").trim();
  }
  return out;
}

/** Lot c — colonnes de l'export du journal. Le détail reste en JSON (fidèle), neutralisé par `csvCell` comme toute cellule. */
export const AUDIT_CSV_COLUMNS = ["at", "adminUserId", "admin", "action", "targetType", "targetId", "before", "after", "ip", "userAgent"] as const;
export type AuditCsvRow = Record<(typeof AUDIT_CSV_COLUMNS)[number], unknown>;

type AuditRowSource = { createdAt: Date; adminUserId: string; action: string; targetType: string; targetId: string | null; before: unknown; after: unknown; ip: string | null; userAgent: string | null };
export function auditCsvRow(r: AuditRowSource, adminName: string | undefined): AuditCsvRow {
  const json = (v: unknown) => (v === null || v === undefined ? "" : JSON.stringify(v));
  return { at: r.createdAt.toISOString(), adminUserId: r.adminUserId, admin: adminName ?? "", action: r.action, targetType: r.targetType, targetId: r.targetId ?? "", before: json(r.before), after: json(r.after), ip: r.ip ?? "", userAgent: r.userAgent ?? "" };
}

/**
 * Lot a — les auteurs proposés au filtre « Auteur » : tout compte qui a écrit AU MOINS une ligne, admin retiré compris (le
 * journal garde ses gestes), trié par nom ; `active` dit s'il a encore un profil.
 */
export function auditAuthors(ids: readonly string[], users: ReadonlyArray<{ id: string; firstName: string; lastName: string; adminRole?: string | null; adminRoles?: string[] | null }>): Array<{ id: string; name: string; active: boolean }> {
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids
    .map((id) => {
      const u = byId.get(id);
      return { id, name: u ? `${u.firstName} ${u.lastName}`.trim() : "Compte introuvable", active: !!u && (!!u.adminRole || (u.adminRoles?.length ?? 0) > 0) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));
}
