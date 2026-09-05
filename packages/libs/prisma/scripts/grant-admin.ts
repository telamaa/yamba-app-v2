/**
 * grant-admin.ts — pose (ou retire) le rôle ADMIN sur un compte (D54, 8A)
 * =======================================================================
 * Le rôle ADMIN ne s'obtient JAMAIS par l'inscription ni par une route :
 * uniquement par ce script, sur le poste de l'opérateur.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email>                 (SUPER_ADMIN)
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --role MEDIATOR (C-PR3 : SUPER_ADMIN | MEDIATOR | SUPPORT | FINANCE | OPS)
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --roles MEDIATOR,FINANCE (C-PR3bis, D60 1A : profils cumulés)
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --revoke
 *
 * À la première connexion admin, l'application impose l'activation du TOTP.
 * `--revoke` retire le rôle ET désactive la 2FA (secret, codes, pas).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, flag, roleArg] = process.argv.slice(2);
  const ROLES = ["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE", "OPS"] as const; // OPS : C-PR8a (D62 3A)
  type Role = (typeof ROLES)[number];
  const wanted = flag === "--role" ? [roleArg] : flag === "--roles" ? (roleArg ?? "").split(",").map((r) => r.trim()).filter(Boolean) : ["SUPER_ADMIN"];
  const roles = ROLES.filter((r) => wanted.includes(r)) as Role[]; // ordre canonique, doublons ignorés
  if (roles.length === 0 || roles.length !== new Set(wanted).size) {
    console.error(`Profil inconnu dans « ${roleArg} » (attendu : ${ROLES.join(" | ")}, séparés par des virgules)`);
    process.exit(1);
  }
  const role = roles[0]; // profil principal (miroir)
  if (!email) {
    console.error("Usage: grant-admin.ts <email> [--revoke]");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { emailNormalized: email.trim().toLowerCase() } });
  if (!user) {
    console.error(`Aucun compte pour ${email}`);
    process.exit(1);
  }
  if (flag === "--revoke") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: user.roles.filter((r) => r !== "ADMIN"),
        adminRole: null,
        adminRoles: [],
        totpSecretEncrypted: null,
        totpEnabledAt: null,
        totpLastUsedStep: null,
        totpBackupCodeHashes: [],
      },
    });
    console.log(`Rôle ADMIN retiré et 2FA désactivée pour ${user.email}`);
    return;
  }
  const current = (user.adminRoles ?? []).length ? user.adminRoles : user.adminRole ? [user.adminRole] : [];
  if (user.roles.includes("ADMIN") && current.length === roles.length && roles.every((r) => current.includes(r))) {
    console.log(`${user.email} est déjà ${roles.join(" + ")} (2FA ${user.totpEnabledAt ? "active" : "à activer à la première connexion"})`);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { roles: user.roles.includes("ADMIN") ? user.roles : [...user.roles, "ADMIN"], adminRole: role, adminRoles: roles, totpBackupCodeHashes: user.totpBackupCodeHashes ?? [] },
  });
  console.log(`Profils ${roles.join(" + ")} posés sur ${user.email} — la 2FA sera exigée à la première connexion admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
