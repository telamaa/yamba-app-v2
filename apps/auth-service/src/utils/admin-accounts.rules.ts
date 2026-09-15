/**
 * admin-accounts.rules.ts — règles pures des comptes du back-office (recette 02-ADMIN § 5.25, A185, A186)
 * =======================================================================================================
 * Le contrôleur `admin-admins` lit ces règles ; elles ne touchent ni la base ni Redis, et se testent seules.
 */
import type { Prisma } from "@prisma/client";

/** Clés Redis d'une invitation : le jeton → le compte, et le compte → SON jeton vivant (A185 a — un lien par compte). */
export const inviteKey = (token: string) => `admin_invite:${token}`;
export const inviteUserKey = (userId: string) => `admin_invite_user:${userId}`;

/** Document de garde commun aux gestes qui retirent un super administrateur (A186 b). */
export const ADMIN_ACCOUNTS_GUARD_KEY = "admin-accounts";

export type InviteMode =
  | { kind: "NEW" }
  | { kind: "GRANT_ACCESS" } // compte existant AVEC mot de passe : « accès accordé », lien de connexion
  | { kind: "PASSWORD_LINK" } // compte existant SANS mot de passe : lien pour en poser un (ANO-ADM-75)
  | { kind: "REFUSED"; code: "ADMIN_ALREADY_GRANTED" | "ACCOUNT_DELETED"; message: string };

type Existing = { isDeleted?: boolean | null; passwordHash?: string | null; adminRole?: string | null; adminRoles?: string[] | null } | null;

/** Que faire d'une invitation, selon le compte trouvé sous l'adresse. */
export function inviteMode(existing: Existing): InviteMode {
  if (!existing) return { kind: "NEW" };
  if (existing.isDeleted) return { kind: "REFUSED", code: "ACCOUNT_DELETED", message: "This account is deleted and cannot receive an admin profile." };
  if (existing.adminRole || (existing.adminRoles?.length ?? 0) > 0) return { kind: "REFUSED", code: "ADMIN_ALREADY_GRANTED", message: "This account already has an admin profile." };
  return existing.passwordHash ? { kind: "GRANT_ACCESS" } : { kind: "PASSWORD_LINK" };
}

/** A189 a — une invitation EN ATTENTE : profil admin posé, aucun mot de passe, compte non supprimé. Seule elle se renvoie. */
export const isPendingInvitation = (u: Existing): boolean => !!u && !u.isDeleted && !u.passwordHash && (!!u.adminRole || (u.adminRoles?.length ?? 0) > 0);

/** A189 c — un email de sécurité ne part pas vers un compte supprimé ni vers une adresse suppressionnée (D35). */
export const canReceiveAccountEmail = (u: { isDeleted?: boolean | null; emailSuppressedAt?: Date | null } | null): boolean => !!u && !u.isDeleted && !u.emailSuppressedAt;

/** A189 c — les profils ont-ils VRAIMENT changé ? (même liste, autre ordre : rien à annoncer) */
export const rolesChanged = (before: readonly string[], after: readonly string[]): boolean => before.length !== after.length || before.some((r) => !after.includes(r));

/** Le geste retire-t-il le profil SUPER_ADMIN de la cible ? (rétrogradation ou retrait) */
export const removesSuperAdmin = (before: readonly string[], after: readonly string[] | null): boolean => before.includes("SUPER_ADMIN") && !(after ?? []).includes("SUPER_ADMIN");

/**
 * A186 a — les AUTRES super administrateurs en service : non supprimés, mot de passe posé, 2FA activée. Une invitation en
 * attente ou un compte sans 2FA ne rouvre pas le back-office ; il n'est pas un filet.
 */
export function inServiceSuperAdminsWhere(excludeUserId: string): Prisma.UserWhereInput {
  return {
    id: { not: excludeUserId },
    isDeleted: false,
    passwordHash: { not: null },
    totpEnabledAt: { not: null },
    OR: [{ adminRole: "SUPER_ADMIN" }, { adminRoles: { has: "SUPER_ADMIN" } }],
  };
}

/** Prisma : violation d'unicité (deux invitations simultanées de la même adresse). */
export const isUniqueViolation = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
