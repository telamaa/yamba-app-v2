/**
 * registration-rules.ts — règle PURE de validation d'une inscription (ANO-API-03)
 * ==============================================================================
 * Recette API du 08/09/2026, fiche API-GW-14. `validateRegistrationData` s'arrêtait au
 * PREMIER champ fautif et jetait un message anglais : le front ne pouvait pas afficher
 * l'erreur sous chaque champ, alors que deal-service et message-service rendent déjà un
 * objet `errors`. La règle est isolée ici — sans Redis, sans Prisma, sans mailer — pour
 * être testable telle quelle, comme `password-rules` et `otp-policy` à côté.
 *
 * Le mot de passe n'est PAS validé ici : il a ses propres règles (`password-rules.ts`) et
 * son erreur typée (`details.type: "password"` + code), que l'appelant agrège.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegistrationFields = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  termsAccepted?: boolean;
  termsVersion?: string;
  privacyVersion?: string;
};

/** Codes d'erreur par champ — jamais une phrase : le client traduit (comme le PATCH profil). */
export type RegistrationErrors = Record<string, "REQUIRED" | "INVALID_FORMAT" | "TERMS_NOT_ACCEPTED">;

/**
 * Examine TOUS les champs et rend l'ensemble des fautes. Objet vide = rien à redire
 * (le mot de passe restant à valider par l'appelant).
 */
export function collectRegistrationErrors(data: RegistrationFields): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const email = data.email?.trim();

  if (!firstName) errors.firstName = "REQUIRED";
  if (!lastName) errors.lastName = "REQUIRED";
  if (!email) errors.email = "REQUIRED";
  if (!data.password) errors.password = "REQUIRED";
  if (data.termsAccepted !== true) errors.termsAccepted = "TERMS_NOT_ACCEPTED";
  if (!data.termsVersion?.trim()) errors.termsVersion = "REQUIRED";
  if (!data.privacyVersion?.trim()) errors.privacyVersion = "REQUIRED";

  if (email && !EMAIL_REGEX.test(email.toLowerCase())) errors.email = "INVALID_FORMAT";

  return errors;
}
