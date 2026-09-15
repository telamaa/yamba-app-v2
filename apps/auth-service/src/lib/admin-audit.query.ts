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
