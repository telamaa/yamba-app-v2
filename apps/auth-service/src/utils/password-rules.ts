/**
 * password-rules.ts — règles de robustesse du mot de passe (pur, sans I/O)
 * =======================================================================
 * Chaque règle a un CODE stable (`PasswordRuleCode`) renvoyé dans
 * `details: { type: "password", code }` de la ValidationError : le front
 * nomme le critère fautif dans la langue de l'utilisateur à partir du code,
 * jamais à partir du message (surface d'API en anglais).
 *
 * Miroir front : apps/user-ui/src/lib/auth/password-strength.ts — les deux
 * listes de règles DOIVENT rester alignées (même seuils, mêmes motifs).
 */
import { ValidationError } from "@packages/error-handler";

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

export type PasswordErrorDetails = {
  type: "password";
  code: PasswordRuleCode;
  field: "password";
};

export type PasswordValidationContext = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export const PASSWORD_MIN_LENGTH = 8;

const SEQUENTIAL_PATTERNS = [
  "1234", "2345", "3456", "4567", "5678", "6789",
  "abcd", "azerty", "qwerty", "password", "motdepasse",
];

const RULE_MESSAGES: Record<PasswordRuleCode, string> = {
  PASSWORD_REQUIRED: "Password is required.",
  PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
  PASSWORD_NO_LOWERCASE: "Password must contain at least one lowercase letter.",
  PASSWORD_NO_UPPERCASE: "Password must contain at least one uppercase letter.",
  PASSWORD_NO_DIGIT: "Password must contain at least one digit.",
  PASSWORD_NO_SPECIAL: "Password must contain at least one special character.",
  PASSWORD_LOOKS_LIKE_DATE: "Password must not look like an easy-to-guess date.",
  PASSWORD_PREDICTABLE:
    "Password must not contain simple sequences or repeated characters.",
  PASSWORD_CONTAINS_PERSONAL_INFO:
    "Password must not contain your first name, last name or email address.",
};

export function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function looksLikeSimpleDate(password: string): boolean {
  const digits = password.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) || /^\d{8}$/.test(digits);
}

function hasSequentialPattern(password: string): boolean {
  const lower = password.toLowerCase();
  return SEQUENTIAL_PATTERNS.some((pattern) => lower.includes(pattern));
}

function hasTooManyRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

function containsPersonalInfo(
  password: string,
  context: PasswordValidationContext
): boolean {
  const firstName = normalizeForComparison(context.firstName ?? "");
  const lastName = normalizeForComparison(context.lastName ?? "");
  const emailLocalPart = normalizeForComparison(context.email ?? "").split("@")[0] ?? "";
  const normalizedPassword = normalizeForComparison(password);

  return [firstName, lastName, emailLocalPart]
    .filter((value) => value.length >= 3)
    .some((value) => normalizedPassword.includes(value));
}

/**
 * Renvoie le code de la PREMIÈRE règle violée, ou null si tout est bon.
 * L'ordre est celui de l'indicateur front (du plus simple au plus subtil).
 */
export function findPasswordRuleViolation(
  password: string,
  context: PasswordValidationContext = {}
): PasswordRuleCode | null {
  if (!password) return "PASSWORD_REQUIRED";
  if (password.length < PASSWORD_MIN_LENGTH) return "PASSWORD_TOO_SHORT";
  if (!/[a-z]/.test(password)) return "PASSWORD_NO_LOWERCASE";
  if (!/[A-Z]/.test(password)) return "PASSWORD_NO_UPPERCASE";
  if (!/\d/.test(password)) return "PASSWORD_NO_DIGIT";
  if (!/[^A-Za-z0-9]/.test(password)) return "PASSWORD_NO_SPECIAL";
  if (looksLikeSimpleDate(password)) return "PASSWORD_LOOKS_LIKE_DATE";
  if (hasSequentialPattern(password) || hasTooManyRepeatedChars(password)) {
    return "PASSWORD_PREDICTABLE";
  }
  if (containsPersonalInfo(password, context)) return "PASSWORD_CONTAINS_PERSONAL_INFO";
  return null;
}

/**
 * Lève une ValidationError (400) portant le code de la règle violée.
 */
export function validatePasswordStrength(
  password: string,
  context?: PasswordValidationContext
): void {
  const code = findPasswordRuleViolation(password, context);
  if (!code) return;
  throw new ValidationError(RULE_MESSAGES[code], {
    type: "password",
    code,
    field: "password",
  } satisfies PasswordErrorDetails);
}
