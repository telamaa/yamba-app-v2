/**
 * admin-users.schema.ts — profils admin, utilisateurs, suspension, sessions (C-PR3, D56)
 * ======================================================================================
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

/** C-PR8a (D62 3A) — OPS : exploitation technique (paramètres d'exploitation, état des services, maintenance), jamais l'argent ni les comptes. */
/** C-PR8b (D63 6A) — PRIVACY : données personnelles (registre des demandes, effacement, export nominatif). */
export const AdminRoleSchema = z.enum(["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE", "OPS", "PRIVACY"]).meta({ id: "AdminRole" });
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const AccountStatusSchema = z.enum(["ACTIVE", "RESTRICTED", "SUSPENDED"]).meta({ id: "AccountStatus" });
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

/** Matrice route → rôles (SUPER_ADMIN implicite partout). Source unique, lue par les middlewares et l'admin-ui. */
export const ADMIN_PERMISSIONS = {
  "disputes.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "disputes.decide": ["MEDIATOR"],
  "users.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "users.suspension.propose": ["SUPPORT", "MEDIATOR"],
  "users.suspension.apply": ["MEDIATOR"],
  "audit.read": ["FINANCE"],
  "admins.manage": [],
  // C-PR4 (D57)
  "trips.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  "tickets.review": ["SUPPORT", "MEDIATOR"],
  "trips.hide.propose": ["SUPPORT", "MEDIATOR"],
  "trips.hide.apply": ["MEDIATOR"],
  "kpi.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS"],
  // C-PR5 (D58 6A)
  "finances.read": ["FINANCE", "MEDIATOR"],
  "payouts.retry": ["FINANCE", "MEDIATOR"],
  "payouts.resolve": ["FINANCE", "MEDIATOR"],
  // C-PR5b (D58 5A, 3A-c)
  "finances.export": ["FINANCE"],
  "refunds.manual.propose": ["FINANCE", "SUPPORT"],
  "refunds.manual.apply": [],
  // C-PR6 (D59 7A)
  "pilotage.read": ["FINANCE", "MEDIATOR"],
  "deals.history.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  // C-PR7a (D60 2A) — exports : opérationnels (sans email ni téléphone) vs personnels (SUPER_ADMIN seul, motif au journal)
  "exports.operational": ["FINANCE", "MEDIATOR"],
  "exports.personal": ["PRIVACY"], // A143 (D63 6A) — révise D60 2A : SUPER_ADMIN ou PRIVACY
  // F-PR3 (D61 7A) — lire une conversation depuis un dossier (journalisé), traiter un message signalé. FINANCE n'a rien à y lire.
  "conversations.read": ["MEDIATOR", "SUPPORT"],
  "reports.review": ["MEDIATOR", "SUPPORT"],
  // C-PR8a (D62 3A) — paramètres : lecture ouverte à tous les profils ; portée métier SUPER_ADMIN seul ; portée exploitation OPS.
  "settings.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS"],
  "settings.business.write": [],
  "settings.operations.write": ["OPS"],
  // C-PR8b (D63 6A) — données personnelles
  "privacy.requests.read": ["PRIVACY"],
  "users.erase": ["PRIVACY"],
  // C-PR8c (D64) — état des services (lecture pour tous), maintenance (OPS ou SUPER_ADMIN)
  "status.read": ["MEDIATOR", "SUPPORT", "FINANCE", "OPS", "PRIVACY"],
  "maintenance.write": ["OPS"],
} as const;
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function adminRoleAllows(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return (ADMIN_PERMISSIONS[permission] as readonly string[]).includes(role);
}

/* ── C-PR3bis (D60 1A) — profils CUMULÉS : l'union des permissions ── */
export const ADMIN_ROLES_ORDER: readonly AdminRole[] = ["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE", "OPS", "PRIVACY"];
export const AdminRolesSchema = z
  .array(AdminRoleSchema)
  .min(1)
  .max(6)
  .meta({ id: "AdminRoles", description: "Profils cumulés d'un compte admin (au moins un) — l'union des permissions ; normalisés côté serveur (ordre canonique, doublons ignorés)" });
/** Ordre canonique, doublons ignorés (un `transform` Zod ne se représente pas en OpenAPI : on normalise en code). */
export function normalizeAdminRoles(roles: readonly AdminRole[]): AdminRole[] {
  return ADMIN_ROLES_ORDER.filter((r) => roles.includes(r));
}
/** true si l'UN des profils a la permission (SUPER_ADMIN passe partout). */
export function adminRolesAllow(roles: readonly AdminRole[] | null | undefined, permission: AdminPermission): boolean {
  return !!roles && roles.some((r) => adminRoleAllows(r, permission));
}
/** Profil principal (affiché, miroir `User.adminRole`) : SUPER_ADMIN d'abord, sinon le premier dans l'ordre canonique. */
export function primaryAdminRole(roles: readonly AdminRole[] | null | undefined): AdminRole | null {
  if (!roles || roles.length === 0) return null;
  return ADMIN_ROLES_ORDER.find((r) => roles.includes(r)) ?? roles[0];
}
/** Lecture tolérante d'un enregistrement (liste absente sur les comptes d'avant C-PR3bis → le profil principal). */
export function adminRolesOf(u: { adminRoles?: readonly string[] | null; adminRole?: string | null }): AdminRole[] {
  const list = (u.adminRoles ?? []).filter((r): r is AdminRole => (ADMIN_ROLES_ORDER as readonly string[]).includes(r));
  if (list.length) return ADMIN_ROLES_ORDER.filter((r) => list.includes(r));
  return u.adminRole && (ADMIN_ROLES_ORDER as readonly string[]).includes(u.adminRole) ? [u.adminRole as AdminRole] : [];
}

export const SUSPENSION_MIN_REASON_LENGTH = 20;

export const AdminUserSummarySchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phoneE164: z.string().nullable(),
    roles: z.array(z.string()),
    adminRole: AdminRoleSchema.nullable(),
    adminRoles: z.array(AdminRoleSchema),
    accountStatus: AccountStatusSchema,
    carrierStatus: z.string(),
    createdAt: z.string().datetime(),
    matchedOn: z.string().nullable().meta({ description: "What the search matched: email | name | phone | dealId | ticket" }),
  })
  .meta({ id: "AdminUserSummary" });
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminUsersResponseSchema = z
  .object({ items: z.array(AdminUserSummarySchema), total: z.number().int(), nextCursor: z.string().nullable().optional().meta({ description: "C-PR7a — id du dernier élément ; absent = fin" }) })
  .meta({ id: "AdminUsersResponse" });

/* ── C-PR7a (D60 2A) — recherche poussée des utilisateurs ── */
export const EXPORT_REASON_MIN_LENGTH = 20;
export const AdminUsersQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    role: z.enum(["SHIPPER", "CARRIER", "ADMIN"]).optional(),
    accountStatus: AccountStatusSchema.optional(),
    carrierStatus: z.string().trim().max(40).optional(),
    stripeReady: z.enum(["1", "0"]).optional().meta({ description: "1 = compte Connect avec virements activés" }),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sort: z.enum(["createdAt", "lastName"]).default("createdAt"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    cursor: ObjectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .meta({ id: "AdminUsersQuery" });
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;

const DealLineSchema = z.object({
  id: ObjectIdSchema,
  status: z.string(),
  role: z.enum(["SHIPPER", "CARRIER"]),
  originCity: z.string(),
  destinationCity: z.string(),
  totalShipperCents: z.number().int(),
  transportCents: z.number().int(),
  currencyCode: z.string(),
  disputeTicket: z.string().nullable(),
  requestedAt: z.string().datetime(),
});

export const AdminUserFileSchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phoneE164: z.string().nullable(),
    preferredLocale: z.string(),
    roles: z.array(z.string()),
    adminRole: AdminRoleSchema.nullable(),
    adminRoles: z.array(AdminRoleSchema),
    accountStatus: AccountStatusSchema,
    suspension: z
      .object({ level: AccountStatusSchema, reason: z.string(), until: z.string().datetime().nullable(), at: z.string().datetime(), byAdmin: z.string() })
      .nullable(),
    suspensionProposal: z
      .object({ level: z.string(), reason: z.string(), byAdmin: z.string(), at: z.string().datetime() })
      .nullable(),
    createdAt: z.string().datetime(),
    isDeleted: z.boolean(),
    isMe: z.boolean().meta({ description: "The admin reading the file IS this user (conflict of interest guard)" }),
    carrier: z
      .object({
        status: z.string(),
        stripeAccountId: z.string().nullable().meta({ description: "Masked (acct_…xxxx)" }),
        stripeChargesEnabled: z.boolean(),
        stripePayoutsEnabled: z.boolean(),
        reputationLevel: z.string().nullable(),
        ratingsAvg: z.number(),
        ratingsCount: z.number().int(),
        completedDealsCount: z.number().int(),
        lateCancellationsCount: z.number().int(),
        disputesLostCount: z.number().int(),
      })
      .nullable(),
    shipper: z.object({
      reputationLevel: z.string().nullable(),
      ratingsAvg: z.number(),
      ratingsCount: z.number().int(),
      completedDealsCount: z.number().int(),
      lateCancellationsCount: z.number().int(),
      disputesLostCount: z.number().int(),
    }),
    activity: z.object({
      trips: z.array(z.object({ id: ObjectIdSchema, status: z.string(), originCity: z.string(), destinationCity: z.string(), departureAt: z.string().datetime() })),
      deals: z.array(DealLineSchema),
      activeDealsCount: z.number().int(),
      activeSessionsCount: z.number().int(),
    }),
    adminActions: z.array(
      z.object({ id: ObjectIdSchema, at: z.string().datetime(), admin: z.string(), action: z.string(), after: z.unknown().nullable() })
    ),
  })
  .meta({ id: "AdminUserFile", description: "Everything an operator needs on a user — never a secret, never a delivery code" });
export type AdminUserFile = z.infer<typeof AdminUserFileSchema>;

export const ProposeSuspensionRequestSchema = z
  .object({
    level: z.enum(["RESTRICTED", "SUSPENDED"]),
    reason: z.string().trim().min(SUSPENSION_MIN_REASON_LENGTH).max(2000),
  })
  .meta({ id: "ProposeSuspensionRequest", description: "SUPPORT proposes; MEDIATOR / SUPER_ADMIN executes (D56 3A)" });
export type ProposeSuspensionRequest = z.infer<typeof ProposeSuspensionRequestSchema>;

export const ApplySuspensionRequestSchema = z
  .object({
    level: z.enum(["RESTRICTED", "SUSPENDED"]),
    reason: z.string().trim().min(SUSPENSION_MIN_REASON_LENGTH).max(2000),
    until: z.string().datetime().optional().meta({ description: "Optional end; absent = until lifted" }),
  })
  .meta({ id: "ApplySuspensionRequest" });
export type ApplySuspensionRequest = z.infer<typeof ApplySuspensionRequestSchema>;

export const LiftSuspensionRequestSchema = z
  .object({ reason: z.string().trim().min(SUSPENSION_MIN_REASON_LENGTH).max(2000) })
  .meta({ id: "LiftSuspensionRequest" });
export type LiftSuspensionRequest = z.infer<typeof LiftSuspensionRequestSchema>;

export const InviteAdminRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    adminRoles: AdminRolesSchema,
  })
  .meta({ id: "InviteAdminRequest", description: "SUPER_ADMIN only. New account: no client role, password set through the emailed link (48h)." });
export type InviteAdminRequest = z.infer<typeof InviteAdminRequestSchema>;

export const AcceptAdminInviteRequestSchema = z
  .object({ token: z.string().min(32).max(128), password: z.string().min(8).max(128) })
  .meta({ id: "AcceptAdminInviteRequest" });
export type AcceptAdminInviteRequest = z.infer<typeof AcceptAdminInviteRequestSchema>;

export const UpdateAdminRoleRequestSchema = z.object({ adminRoles: AdminRolesSchema }).meta({ id: "UpdateAdminRoleRequest", description: "C-PR3bis : la liste complète des profils (remplace)" });
export type UpdateAdminRoleRequest = z.infer<typeof UpdateAdminRoleRequestSchema>;

export const AdminAccountSchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    adminRole: AdminRoleSchema,
    adminRoles: z.array(AdminRoleSchema),
    totpEnabled: z.boolean(),
    inviteAccepted: z.boolean().meta({ description: "false while the invited account has no password yet" }),
    createdAt: z.string().datetime(),
  })
  .meta({ id: "AdminAccount" });
export type AdminAccount = z.infer<typeof AdminAccountSchema>;

export const AdminSessionItemSchema = z
  .object({ jti: z.string(), createdAt: z.string().datetime(), lastActivityAt: z.string().datetime(), current: z.boolean() })
  .meta({ id: "AdminSessionItem" });
export type AdminSessionItem = z.infer<typeof AdminSessionItemSchema>;
