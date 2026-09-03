/**
 * grant-admin.ts — pose (ou retire) le rôle ADMIN sur un compte (D54, 8A)
 * =======================================================================
 * Le rôle ADMIN ne s'obtient JAMAIS par l'inscription ni par une route :
 * uniquement par ce script, sur le poste de l'opérateur.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email>
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --revoke
 *
 * À la première connexion admin, l'application impose l'activation du TOTP.
 * `--revoke` retire le rôle ET désactive la 2FA (secret, codes, pas).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, flag] = process.argv.slice(2);
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
        totpSecretEncrypted: null,
        totpEnabledAt: null,
        totpLastUsedStep: null,
        totpBackupCodeHashes: [],
      },
    });
    console.log(`Rôle ADMIN retiré et 2FA désactivée pour ${user.email}`);
    return;
  }
  if (user.roles.includes("ADMIN")) {
    console.log(`${user.email} est déjà ADMIN (2FA ${user.totpEnabledAt ? "active" : "à activer à la première connexion"})`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { roles: [...user.roles, "ADMIN"], totpBackupCodeHashes: [] } });
  console.log(`Rôle ADMIN posé sur ${user.email} — la 2FA sera exigée à la première connexion admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
