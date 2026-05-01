export type PasswordChecks = {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
  personalInfo: boolean;
  simpleDate: boolean;
  predictable: boolean;
};

export type PasswordContext = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type PasswordLevel = "empty" | "weak" | "medium" | "strong" | "excellent";

const SEQUENTIAL_PATTERNS = [
  "1234", "2345", "3456", "4567", "5678", "6789",
  "abcd", "azerty", "qwerty", "password", "motdepasse",
];

function normalizeForComparison(value: string): string {
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

export function getPasswordChecks(
  password: string,
  context: PasswordContext = {}
): PasswordChecks {
  const normalizedPassword = normalizeForComparison(password);
  const firstName = normalizeForComparison(context.firstName ?? "");
  const lastName = normalizeForComparison(context.lastName ?? "");
  const emailLocalPart = normalizeForComparison(context.email ?? "").split("@")[0] ?? "";

  const forbiddenParts = [firstName, lastName, emailLocalPart].filter(
    (value) => value.length >= 3
  );
  const includesPersonalInfo = forbiddenParts.some((value) =>
    normalizedPassword.includes(value)
  );

  return {
    minLength: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    personalInfo: !includesPersonalInfo,
    simpleDate: !looksLikeSimpleDate(password),
    predictable: !hasSequentialPattern(password) && !hasTooManyRepeatedChars(password),
  };
}

export function getPasswordScore(checks: PasswordChecks): number {
  return Object.values(checks).filter(Boolean).length;
}

export function getPasswordLevel(password: string, score: number): PasswordLevel {
  if (password.length === 0) return "empty";
  if (score <= 2) return "weak";
  if (score <= 4) return "weak";
  if (score <= 6) return "medium";
  if (score === 7) return "strong";
  return "excellent";
}

export function isPasswordValid(checks: PasswordChecks): boolean {
  return Object.values(checks).every(Boolean);
}
