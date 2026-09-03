/**
 * auth-error-codes.ts — codes d'erreur de l'auth-service → messages localisés
 * ==========================================================================
 * L'API parle anglais (surface publique) ; le front ne montre JAMAIS un
 * `message` brut de l'API à l'utilisateur. Il lit `details.code` (types
 * « safe » exposés par error-middleware : password, register, otp) et
 * construit la phrase dans la langue de l'interface.
 *
 * Miroir serveur : apps/auth-service/src/utils/password-rules.ts (codes
 * PASSWORD_*) et auth.helper.ts (OtpErrorDetails).
 */
import type { PasswordChecks } from "./password-strength";

export type PasswordRuleCode =
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_NO_LOWERCASE"
  | "PASSWORD_NO_UPPERCASE"
  | "PASSWORD_NO_DIGIT"
  | "PASSWORD_NO_SPECIAL"
  | "PASSWORD_LOOKS_LIKE_DATE"
  | "PASSWORD_PREDICTABLE"
  | "PASSWORD_CONTAINS_PERSONAL_INFO";

export type OtpErrorCode = "OTP_INCORRECT" | "OTP_INVALIDATED" | "OTP_LOCKED" | "OTP_EXPIRED";

export type AuthErrorDetails =
  | { type: "password"; code: PasswordRuleCode; field?: "password" }
  | { type: "register"; code: "EMAIL_ALREADY_USED"; field?: "email" }
  | {
      type: "otp";
      code?: OtpErrorCode;
      attemptsLeft?: number;
      locked?: boolean;
      lockUntilSeconds?: number;
      otpInvalidated?: boolean;
    };

/** Ordre d'affichage = ordre de vérification serveur (du plus simple au plus subtil). */
const CHECK_ORDER: Array<keyof PasswordChecks> = [
  "minLength",
  "lowercase",
  "uppercase",
  "number",
  "special",
  "simpleDate",
  "predictable",
  "personalInfo",
];

const CODE_TO_CHECK: Record<PasswordRuleCode, keyof PasswordChecks | null> = {
  PASSWORD_REQUIRED: null,
  PASSWORD_TOO_SHORT: "minLength",
  PASSWORD_NO_LOWERCASE: "lowercase",
  PASSWORD_NO_UPPERCASE: "uppercase",
  PASSWORD_NO_DIGIT: "number",
  PASSWORD_NO_SPECIAL: "special",
  PASSWORD_LOOKS_LIKE_DATE: "simpleDate",
  PASSWORD_PREDICTABLE: "predictable",
  PASSWORD_CONTAINS_PERSONAL_INFO: "personalInfo",
};

/** Premier critère non satisfait (null si tout est bon). */
export function firstFailingCheck(checks: PasswordChecks): keyof PasswordChecks | null {
  return CHECK_ORDER.find((key) => !checks[key]) ?? null;
}

/**
 * Phrase complète nommant LE critère fautif (formulation impersonnelle,
 * valable quel que soit le registre tutoiement/vouvoiement de la page).
 */
export function passwordCheckMessage(fr: boolean, check: keyof PasswordChecks | null): string {
  switch (check) {
    case "minLength":
      return fr
        ? "Le mot de passe doit contenir au moins 8 caractères."
        : "The password must be at least 8 characters long.";
    case "lowercase":
      return fr
        ? "Le mot de passe doit contenir au moins une lettre minuscule."
        : "The password must contain at least one lowercase letter.";
    case "uppercase":
      return fr
        ? "Le mot de passe doit contenir au moins une lettre majuscule."
        : "The password must contain at least one uppercase letter.";
    case "number":
      return fr
        ? "Le mot de passe doit contenir au moins un chiffre."
        : "The password must contain at least one number.";
    case "special":
      return fr
        ? "Le mot de passe doit contenir au moins un caractère spécial (!, ?, #, …)."
        : "The password must contain at least one special character (!, ?, #, …).";
    case "simpleDate":
      return fr
        ? "Le mot de passe ne doit pas ressembler à une date (année, naissance…)."
        : "The password must not look like a date (year, birthday…).";
    case "predictable":
      return fr
        ? "Le mot de passe ne doit pas contenir de suite simple (1234, azerty) ni de caractère répété trois fois."
        : "The password must not contain a simple sequence (1234, qwerty) or a character repeated three times.";
    case "personalInfo":
      return fr
        ? "Le mot de passe ne doit pas contenir le prénom, le nom ni l'adresse e-mail."
        : "The password must not contain the first name, last name or email address.";
    default:
      return fr ? "Le mot de passe est requis." : "Password is required.";
  }
}

export function passwordCodeMessage(fr: boolean, code: PasswordRuleCode): string {
  return passwordCheckMessage(fr, CODE_TO_CHECK[code]);
}

export function registerCodeMessage(fr: boolean, code: "EMAIL_ALREADY_USED"): string {
  if (code === "EMAIL_ALREADY_USED") {
    return fr
      ? "Un compte existe déjà avec cet e-mail. Connectez-vous ou utilisez « Mot de passe oublié »."
      : "An account already exists with this email. Sign in or use “Forgot password”.";
  }
  return fr ? "Inscription impossible pour le moment." : "Unable to sign up right now.";
}

/** Message principal d'une erreur OTP (le compte à rebours du verrou est rendu à part). */
export function otpCodeMessage(
  fr: boolean,
  details: Extract<AuthErrorDetails, { type: "otp" }>
): string {
  switch (details.code) {
    case "OTP_LOCKED":
      return fr
        ? "Trop de tentatives : saisie bloquée temporairement."
        : "Too many attempts: entry temporarily blocked.";
    case "OTP_INVALIDATED":
      return fr
        ? "Code incorrect. Ce code n'est plus valable : demande un nouveau code une fois le délai écoulé."
        : "Incorrect code. This code is no longer valid: request a new one once the delay has passed.";
    case "OTP_EXPIRED":
      return fr
        ? "Ce code a expiré. Demande un nouveau code."
        : "This code has expired. Request a new one.";
    case "OTP_INCORRECT":
    default:
      return fr ? "Code incorrect." : "Incorrect code.";
  }
}

export function readAuthErrorDetails(data: unknown): AuthErrorDetails | null {
  if (!data || typeof data !== "object") return null;
  const details = (data as { details?: unknown }).details;
  if (!details || typeof details !== "object") return null;
  const type = (details as { type?: unknown }).type;
  if (type === "password" || type === "register" || type === "otp") {
    return details as AuthErrorDetails;
  }
  return null;
}
