/**
 * @packages/admin-audit — journal d'audit des actions admin (D7, D54 8A)
 * =====================================================================
 * Une ligne `AdminAction` par geste : QUI (adminUserId), QUOI (action),
 * SUR QUOI (targetType/targetId), AVANT/APRÈS (instantanés JSON), d'où (ip,
 * userAgent). Écrite dans la MÊME transaction que le geste quand il en a une
 * (`tx.adminAction`), sinon directement — jamais « après coup », jamais en
 * best-effort : un geste dont le journal échoue n'a pas eu lieu.
 *
 * Zéro dépendance : le writer est typé structurellement (PrismaClient ou
 * client transactionnel), la lib ne connaît ni Prisma ni Express.
 */

export const ADMIN_ACTIONS = [
  "ADMIN_LOGIN",
  "ADMIN_LOGOUT",
  "ADMIN_TOTP_ENABLED",
  "ADMIN_BACKUP_CODE_USED",
  "ADMIN_BACKUP_CODES_REGENERATED", // A190 a (recette § 6)
  "DISPUTE_VIEWED",
  "DISPUTE_RESOLVED",
  "RETENTION_ARBITRATED",
  // C-PR3 (D56)
  "ADMIN_INVITED",
  "ADMIN_INVITE_ACCEPTED",
  "ADMIN_INVITE_RESENT", // A189 a
  "ADMIN_ROLE_CHANGED",
  "ADMIN_REVOKED",
  "ADMIN_SESSION_REVOKED",
  "ADMIN_SESSIONS_REVOKED", // A190 b — « toutes mes autres sessions », une ligne avec le nombre
  "USER_VIEWED",
  "USER_SUSPENSION_PROPOSED",
  "USER_SUSPENDED",
  "USER_RESTRICTED",
  "USER_REINSTATED",
  // C-PR4 (D57)
  "TRIP_VIEWED",
  "TRIP_HIDE_PROPOSED",
  "TRIP_HIDDEN",
  "TRIP_UNHIDDEN",
  "DOCUMENT_VIEWED",
  "TICKET_VERIFIED",
  "TICKET_REJECTED",
  // C-PR5 (D58)
  "DEAL_MONEY_VIEWED",
  "DEAL_RECONCILED",
  "PAYOUT_RETRIED",
  "PAYOUT_REVERSAL_RESOLVED",
  // C-PR5b (D58)
  "FINANCE_EXPORTED",
  "REFUND_MANUAL_PROPOSED",
  "REFUND_MANUAL_APPLIED",
  // C-PR6 (D59)
  "DEAL_HISTORY_VIEWED",
  // C-PR6c (D60)
  "PILOTAGE_DRILLDOWN_VIEWED",
  // C-PR7a (D60 2A)
  "EXPORTED",
  // F-PR3 (D61 7A)
  "CONVERSATION_VIEWED",
  "MESSAGE_REPORT_REVIEWED",
  // C-PR8a (D62 5A) — une ligne PAR clé : before / after = { key, before, after, reason, version }
  "SETTING_CHANGED",
  "SETTINGS_RESET",
  // C-PR8b (D63 6A)
  "ACCOUNT_ERASED",
  // A198 (a) — un effacement REFUSÉ était inscrit au seul registre `DataRequest` : c'était le seul geste admin
  // sensible absent du journal, et un audit interne qui lit le journal d'un opérateur croyait qu'il n'avait rien tenté.
  "ACCOUNT_ERASURE_REFUSED",
  "DATA_REQUESTS_VIEWED",
  // C-PR8c (D64 1A)
  "MAINTENANCE_CHANGED",
  // D35 4A
  "EMAIL_SUPPRESSION_LIFTED",
  // D68 3A — décision sur un signalement de trajet ou de membre
  "REPORT_REVIEWED",
] as const;
export type AdminActionType = (typeof ADMIN_ACTIONS)[number];

/**
 * A183 (recette 02-ADMIN § 5.24) — les types de cible réellement écrits. Le filtre « Type de cible » du journal proposait
 * DISPUTE, MAINTENANCE et EXPORT (jamais écrits : un litige se journalise sur son BOOKING, la maintenance et les exports sur
 * SETTINGS / la ressource exportée) et oubliait CONVERSATION : trois choix qui rendaient toujours un journal vide, un type
 * introuvable. Catalogue fermé, typé : un service qui écrirait hors catalogue ne compile plus.
 */
export const ADMIN_TARGET_TYPES = ["USER", "BOOKING", "TRIP", "CONVERSATION", "REPORT", "SESSION", "SETTINGS"] as const;
export type AdminTargetType = (typeof ADMIN_TARGET_TYPES)[number];

export type AdminActionInput = {
  adminUserId: string;
  action: AdminActionType; // A183 — catalogue fermé : une action sans libellé au journal ne compile plus
  targetType: AdminTargetType;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export type AdminActionWriter = {
  adminAction: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

/** Tronque un user-agent (jamais un journal de 8 Ko par ligne). */
function shortUa(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.length > 200 ? ua.slice(0, 200) : ua;
}

export async function recordAdminAction(db: AdminActionWriter, input: AdminActionInput): Promise<void> {
  await db.adminAction.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      before: input.before === undefined ? null : (input.before as object),
      after: input.after === undefined ? null : (input.after as object),
      ip: input.ip ?? null,
      userAgent: shortUa(input.userAgent),
    },
  });
}

/* ── A168 (recette 02-ADMIN § 5.18) — lectures coalescées ─────────────────────────────── */

/** Le minimum de Redis dont la coalescence a besoin (ioredis convient tel quel). */
export type ReadCoalescer = { set(key: string, value: string, mode: "EX", seconds: number, flag: "NX"): Promise<unknown> };

export const READ_COALESCE_SECONDS = 10;
export const readCoalesceKey = (input: Pick<AdminActionInput, "adminUserId" | "action" | "targetType" | "targetId">) =>
  `yamba:audit:read:${input.adminUserId}:${input.action}:${input.targetType}:${input.targetId ?? "-"}`;

/**
 * Une LECTURE déclenchée par l'ouverture d'un écran (USER_VIEWED, DISPUTE_VIEWED, DEAL_MONEY_VIEWED, TRIP_VIEWED,
 * CONVERSATION_VIEWED) : même admin, même action, même cible dans la fenêtre → une seule ligne. Mesuré en recette : trois
 * ouvertures de chaque écran écrivaient six lignes (effet de montage rejoué par React en développement, double appel).
 * Rend `true` si la ligne a été écrite. Sans coalesceur, ou si Redis ne répond pas, la ligne est écrite : un doublon vaut
 * mieux qu'une lecture perdue. Jamais pour un GESTE : un geste s'écrit toujours, dans sa transaction.
 */
export async function recordAdminRead(db: AdminActionWriter, coalescer: ReadCoalescer | null | undefined, input: AdminActionInput, windowSeconds: number = READ_COALESCE_SECONDS): Promise<boolean> {
  if (coalescer) {
    let first = true;
    try {
      first = (await coalescer.set(readCoalesceKey(input), "1", "EX", windowSeconds, "NX")) !== null;
    } catch {
      first = true;
    }
    if (!first) return false;
  }
  await recordAdminAction(db, input);
  return true;
}
