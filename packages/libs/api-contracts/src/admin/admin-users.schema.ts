/**
 * admin-users.schema.ts — profils admin, utilisateurs, suspension, sessions (C-PR3, D56)
 * ======================================================================================
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const AdminRoleSchema = z.enum(["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE"]).meta({ id: "AdminRole" });
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
  "kpi.read": ["MEDIATOR", "SUPPORT", "FINANCE"],
  // C-PR5 (D58 6A)
  "finances.read": ["FINANCE", "MEDIATOR"],
  "payouts.retry": ["FINANCE", "MEDIATOR"],
  "payouts.resolve": ["FINANCE", "MEDIATOR"],
} as const;
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function adminRoleAllows(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return (ADMIN_PERMISSIONS[permission] as readonly string[]).includes(role);
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
    accountStatus: AccountStatusSchema,
    carrierStatus: z.string(),
    createdAt: z.string().datetime(),
    matchedOn: z.string().nullable().meta({ description: "What the search matched: email | name | phone | dealId | ticket" }),
  })
  .meta({ id: "AdminUserSummary" });
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminUsersResponseSchema = z.object({ items: z.array(AdminUserSummarySchema), total: z.number().int() }).meta({ id: "AdminUsersResponse" });
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
    adminRole: AdminRoleSchema,
  })
  .meta({ id: "InviteAdminRequest", description: "SUPER_ADMIN only. New account: no client role, password set through the emailed link (48h)." });
export type InviteAdminRequest = z.infer<typeof InviteAdminRequestSchema>;

export const AcceptAdminInviteRequestSchema = z
  .object({ token: z.string().min(32).max(128), password: z.string().min(8).max(128) })
  .meta({ id: "AcceptAdminInviteRequest" });
export type AcceptAdminInviteRequest = z.infer<typeof AcceptAdminInviteRequestSchema>;

export const UpdateAdminRoleRequestSchema = z.object({ adminRole: AdminRoleSchema }).meta({ id: "UpdateAdminRoleRequest" });
export type UpdateAdminRoleRequest = z.infer<typeof UpdateAdminRoleRequestSchema>;

export const AdminAccountSchema = z
  .object({
    id: ObjectIdSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    adminRole: AdminRoleSchema,
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
