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
] as const;
export type AdminActionType = (typeof ADMIN_ACTIONS)[number];

export type AdminActionInput = {
  adminUserId: string;
  action: AdminActionType | (string & {});
  targetType: "USER" | "BOOKING" | "DISPUTE" | "SESSION" | (string & {});
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
