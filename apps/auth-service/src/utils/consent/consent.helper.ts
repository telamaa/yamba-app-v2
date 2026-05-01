import prisma from "@packages/libs/prisma";
import type { Prisma } from "@prisma/client";

type ConsentMetadata = {
  ipAddress?: string;
  userAgent?: string;
  locale?: string;
};

type RegistrationConsents = {
  termsVersion: string;
  privacyVersion: string;
} & ConsentMetadata;

/**
 * Crée les ConsentLog pour TERMS et PRIVACY au moment de la création du User.
 *
 * À appeler dans la même transaction Prisma que la création du User
 * pour garantir l'atomicité (RGPD : pas de User sans consentement enregistré).
 */
export async function recordRegistrationConsents(
  tx: Prisma.TransactionClient,
  userId: string,
  consents: RegistrationConsents
) {
  const baseMetadata = {
    ipAddress: consents.ipAddress ?? null,
    userAgent: consents.userAgent ?? null,
    locale: consents.locale ?? null,
  };

  await tx.consentLog.createMany({
    data: [
      {
        userId,
        type: "TERMS",
        version: consents.termsVersion,
        ...baseMetadata,
      },
      {
        userId,
        type: "PRIVACY",
        version: consents.privacyVersion,
        ...baseMetadata,
      },
    ],
  });
}

/**
 * Récupère le dernier consentement valide d'un type donné pour un user.
 * Utile pour vérifier si un re-consent est nécessaire suite à une nouvelle version.
 */
export async function getLatestConsent(userId: string, type: "TERMS" | "PRIVACY" | "COOKIES" | "MARKETING") {
  return prisma.consentLog.findFirst({
    where: {
      userId,
      type,
      revokedAt: null,
    },
    orderBy: { acceptedAt: "desc" },
  });
}
