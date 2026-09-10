/**
 * inspect-user.ts — ce que la base sait d'un compte, en JSON, sans rien de secret
 * ==============================================================================
 * Outil de recette (cahier 01-WEB, chapitre 5.2, WEB-INS-9 : « en base, une ligne ConsentLog
 * porte les versions des conditions et l'horodatage serveur ; le compte porte
 * `preferredLocale` »). Le harnais navigateur l'appelle (`jeuEssai.inspecterCompte`) pour
 * prouver ce que l'écran ne montre pas. Jamais l'empreinte du mot de passe : seulement le fait
 * qu'il en existe une.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/inspect-user.ts <email>
 *
 * Sortie : une ligne JSON (`{ found: false }` si l'adresse est inconnue).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error("Usage : inspect-user.ts <email>");
    process.exit(2);
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredLocale: true,
      passwordHash: true,
      isVerified: true,
      createdAt: true,
      consentLogs: { select: { type: true, version: true, acceptedAt: true, locale: true, ipAddress: true, userAgent: true }, orderBy: { acceptedAt: "asc" } },
      authIdentities: { select: { provider: true, email: true, createdAt: true } },
    },
  });
  if (!user) {
    console.log(JSON.stringify({ found: false }));
    return;
  }
  console.log(
    JSON.stringify({
      found: true,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredLocale: user.preferredLocale,
      hasPassword: Boolean(user.passwordHash),
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      consents: user.consentLogs.map((c) => ({
        type: c.type,
        version: c.version,
        acceptedAt: c.acceptedAt,
        locale: c.locale,
        hasIp: Boolean(c.ipAddress),
        hasUserAgent: Boolean(c.userAgent),
      })),
      identities: user.authIdentities.map((i) => ({ provider: i.provider, email: i.email, createdAt: i.createdAt })),
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
