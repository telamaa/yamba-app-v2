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
  "DISPUTE_VIEWED",
  "DISPUTE_RESOLVED",
  "RETENTION_ARBITRATED",
  // C-PR3 (D56)
  "ADMIN_INVITED",
  "ADMIN_INVITE_ACCEPTED",
  "ADMIN_ROLE_CHANGED",
  "ADMIN_REVOKED",
  "ADMIN_SESSION_REVOKED",
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
  "DATA_REQUESTS_VIEWED",
  // C-PR8c (D64 1A)
  "MAINTENANCE_CHANGED",
  // D35 4A
  "EMAIL_SUPPRESSION_LIFTED",
  // D68 3A — décision sur un signalement de trajet ou de membre
  "REPORT_REVIEWED",
] as const;
export type AdminActionType = (typeof ADMIN_ACTIONS)[number];

export type AdminActionInput = {
  adminUserId: string;
  action: AdminActionType | (string & {});
  targetType: "USER" | "BOOKING" | "DISPUTE" | "SESSION" | "TRIP" | "SETTINGS" | (string & {});
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
