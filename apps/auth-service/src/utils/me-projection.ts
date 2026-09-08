/**
 * me-projection.ts — la liste BLANCHE de ce que `GET /auth/me` renvoie (ANO-API-06)
 * =================================================================================
 * Recette API du 08/09/2026, fiche API-AUTH-09 (bloquante). Le contrôleur construisait
 * sa réponse par soustraction :
 *
 *     const { passwordHash, ...safeUser } = fullUser;   // ← interdit
 *
 * C'est le `spread + delete` que les règles non négociables du projet proscrivent : la
 * réponse suit le modèle Prisma, donc TOUT champ ajouté à `User` part vers le client sans
 * que personne ait à y penser. C'est ainsi que les champs TOTP de D54, écrits bien après
 * ce contrôleur, se sont mis à sortir — le secret du second facteur (chiffré) et les
 * hachages des codes de secours d'un compte administrateur, lisibles par toute session.
 *
 * Une liste blanche inverse la charge : un nouveau champ n'est PAS renvoyé tant que
 * quelqu'un ne l'a pas ajouté ici, et le test voisin refuse le silence — il compare cette
 * liste au modèle `User` de `prisma/schema.prisma` et échoue tant qu'un champ nouveau n'a
 * pas été classé, ici ou dans `ME_EXCLUDED_FIELDS`.
 */

/**
 * Champs volontairement TENUS HORS de la réponse, avec la raison — le test vérifie que
 * chacun reste exclu, et le lecteur sait pourquoi sans avoir à fouiller l'historique.
 */
export const ME_EXCLUDED_FIELDS = {
  passwordHash: "secret d'authentification",
  totpSecretEncrypted: "secret du second facteur (D54), même chiffré",
  totpBackupCodeHashes: "hachages des codes de secours (D54) — attaquables hors ligne",
  totpLastUsedStep: "compteur anti-rejeu interne, sans usage client",
  suspensionProposedLevel: "modération INTERNE, avant décision (D56)",
  suspensionProposedReason: "modération INTERNE : motif rédigé par un admin",
  suspensionProposedByAdminId: "modération INTERNE : identité de l'admin",
  suspensionProposedAt: "modération INTERNE (D56)",
  suspendedByAdminId: "identité de l'admin sanctionnant — jamais au membre",
  invitedByAdminId: "chaîne d'invitation admin, interne (D56)",
  emailNormalized: "doublon technique de `email`",
  emailSuppressedReason: "motif fournisseur (rebond, plainte), interne (D35 4A)",
} as const;

/**
 * Ce que le membre reçoit. `avatar` et `carrierPage` sont ajoutés par le contrôleur, qui
 * les projette lui-même (ils portent leurs propres listes blanches).
 *
 * Sont conservés à dessein : `suspendedAt` / `suspensionReason` / `suspensionUntil` — une
 * sanction PRONONCÉE est notifiée au membre, il doit pouvoir la lire ; `totpEnabledAt`,
 * qui dit « la 2FA est active » sans rien livrer d'exploitable ; `emailSuppressedAt`, qui
 * permet d'afficher « nos emails vous reviennent » sans en donner le détail.
 */
export const ME_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  phoneE164: true,
  birthDate: true,
  gender: true,
  preferredLocale: true,
  publicSlug: true,
  roles: true,
  adminRole: true,
  adminRoles: true,
  accountStatus: true,
  carrierStatus: true,
  shipperRatingsAvg: true,
  shipperRatingsCount: true,
  shipperReputationLevel: true,
  shipperCompletedDealsCount: true,
  shipperLateCancellationsCount: true,
  shipperDisputesLostCount: true,
  parcelsSentCount: true,
  adminInvitedAt: true,
  suspendedAt: true,
  suspensionReason: true,
  suspensionUntil: true,
  totpEnabledAt: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  deletedAt: true,
  messagingReminderEmails: true,
  profilePublic: true,
  showCity: true,
  analyticsOptIn: true,
  emailSuppressedAt: true,
} as const;

/** Les relations que le contrôleur charge en plus des scalaires ci-dessus. */
export const ME_RELATION_FIELDS = ["avatar", "carrierPage"] as const;
