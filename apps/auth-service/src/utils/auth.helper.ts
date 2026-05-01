// auth.helper.ts
import { ValidationError } from "@packages/error-handler";
import crypto from "node:crypto";
import redis from "@packages/libs/redis";
import { sendEmail } from "./sendMail";

/** ---------- Constants ---------- */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// OTP lifecycle
const OTP_TTL_SECONDS = 600;                 // 10 min (était 5 min, aligné avec OTP 6 chiffres)
const OTP_COOLDOWN_SECONDS = 60;             // Entre 2 demandes d'OTP
const OTP_REQUEST_WINDOW_SECONDS = 3600;     // Fenêtre 1h pour rate limiting des resend
const OTP_SPAM_LOCK_SECONDS = 3600;          // Lock anti-spam 1h
const OTP_MAX_REQUESTS_PER_WINDOW = 6;       // Max 6 resend par heure

// Compteur d'échecs : durée 24h (matche le palier max)
const OTP_FAILED_COUNTER_TTL = 86400;

// Pending registration & verify token
const PENDING_REG_TTL_SECONDS = 900;
const VERIFY_TOKEN_TTL_SECONDS = 900;

// Forgot password
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 900;

// Refresh tokens
const REFRESH_JTI_TTL_SECONDS = 7 * 24 * 60 * 60;

/** ---------- Types ---------- */
export type GenderInput = "MALE" | "FEMALE" | "OTHER";

export type RegistrationInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  termsAccepted?: boolean;
  termsVersion?: string;
  privacyVersion?: string;
};

export type ValidatedRegistrationData = {
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  password: string;
  termsVersion: string;
  privacyVersion: string;
};

export type CarrierOnboardingInput = {
  phone_number?: string;
  country?: string;
  shopName?: string;
};

export type ValidatedCarrierOnboardingData = {
  phone_number: string;
  country: string;
  shopName?: string;
};

export type PendingRegistration = {
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  termsVersion: string;
  privacyVersion: string;
  consentIp?: string;
  consentUserAgent?: string;
  consentLocale?: string;
};

type OtpScope = "register" | "forgot";

/**
 * Type du contexte enrichi pour les erreurs OTP.
 * Transmis via le paramètre `details` de ValidationError.
 *
 * Le frontend lit ces infos pour afficher un warning progressif :
 *  - orange à ≤2 tentatives restantes
 *  - rouge à 1 tentative restante
 *  - banner lock + timer décompte
 */
export type OtpErrorDetails = {
  type: "otp";
  attemptsLeft?: number;
  locked: boolean;
  lockUntilSeconds?: number;
};

/** ---------- Redis Keys ---------- */
const keys = {
  otp: (scope: OtpScope, emailKey: string) => `otp:${scope}:${emailKey}`,
  otpCooldown: (scope: OtpScope, emailKey: string) => `otp_cooldown:${scope}:${emailKey}`,
  otpSpamLock: (scope: OtpScope, emailKey: string) => `otp_spam_lock:${scope}:${emailKey}`,
  otpLock: (scope: OtpScope, emailKey: string) => `otp_lock:${scope}:${emailKey}`,
  otpAttempts: (scope: OtpScope, emailKey: string) => `otp_attempts:${scope}:${emailKey}`,
  otpRequestCount: (scope: OtpScope, emailKey: string) => `otp_request_count:${scope}:${emailKey}`,
  otpSecurityAlerted: (scope: OtpScope, emailKey: string) =>
    `otp_security_alerted:${scope}:${emailKey}`,

  pendingUser: (emailKey: string) => `pending_user:${emailKey}`,
  verifyToken: (token: string) => `verify_token:${token}`,

  passwordResetToken: (token: string) => `pwd_reset_token:${token}`,

  refreshJti: (userId: string) => `refresh_jti:${userId}`,
};

/** ---------- Utils ---------- */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Calcule la durée de lock en secondes selon le numéro d'échec cumulé.
 *
 * Barème exponential backoff Yamba :
 *  - 1er-2ème échec : 0s (pas de pénalité, juste warning visuel)
 *  - 3ème échec : 60s (1 min)
 *  - 4ème échec : 300s (5 min)
 *  - 5ème échec : 1800s (30 min)
 *  - 6ème échec et plus : 86400s (24h) + alerte sécurité par email
 */
function getLockDurationForAttempt(attemptNumber: number): number {
  if (attemptNumber <= 2) return 0;
  if (attemptNumber === 3) return 60;
  if (attemptNumber === 4) return 300;
  if (attemptNumber === 5) return 1800;
  return 86400; // 6 et plus
}

/**
 * Formatte une durée en secondes en string lisible pour l'utilisateur final.
 */
function formatLockDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second(s)`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minute(s)`;
  return `${Math.ceil(seconds / 3600)} hour(s)`;
}

/** ---------- Validation ---------- */
function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function looksLikeSimpleDate(password: string) {
  const digits = password.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) || /^\d{8}$/.test(digits);
}

function hasSequentialPattern(password: string) {
  const lower = password.toLowerCase();
  const patterns = [
    "1234", "2345", "3456", "4567", "5678", "6789",
    "abcd", "azerty", "qwerty", "password", "motdepasse",
  ];
  return patterns.some((pattern) => lower.includes(pattern));
}

function hasTooManyRepeatedChars(password: string) {
  return /(.)\1{2,}/.test(password);
}

type PasswordValidationContext = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export const validatePasswordStrength = (
  password: string,
  context?: PasswordValidationContext
) => {
  if (!password) {
    throw new ValidationError("Password is required!");
  }

  const commonRuleMessage =
    "Choose a stronger password with at least 8 characters, including an uppercase letter, a lowercase letter, a number and a special character.";

  if (password.length < 8) throw new ValidationError(commonRuleMessage);
  if (!/[a-z]/.test(password)) throw new ValidationError(commonRuleMessage);
  if (!/[A-Z]/.test(password)) throw new ValidationError(commonRuleMessage);
  if (!/\d/.test(password)) throw new ValidationError(commonRuleMessage);
  if (!/[^A-Za-z0-9]/.test(password)) throw new ValidationError(commonRuleMessage);

  if (looksLikeSimpleDate(password)) {
    throw new ValidationError(
      "For your security, avoid passwords that look like an easy-to-guess date."
    );
  }

  if (hasSequentialPattern(password) || hasTooManyRepeatedChars(password)) {
    throw new ValidationError(
      "For your security, avoid simple sequences, repeated characters, or overly predictable passwords."
    );
  }

  const firstName = normalizeForComparison(context?.firstName ?? "");
  const lastName = normalizeForComparison(context?.lastName ?? "");
  const emailLocalPart = normalizeForComparison(context?.email ?? "").split("@")[0] ?? "";
  const normalizedPassword = normalizeForComparison(password);

  const forbiddenParts = [firstName, lastName, emailLocalPart].filter(
    (value) => value.length >= 3
  );

  for (const item of forbiddenParts) {
    if (normalizedPassword.includes(item)) {
      throw new ValidationError(
        "For your security, do not use your first name, last name, or email address in your password."
      );
    }
  }
};

export const validateRegistrationData = (
  data: RegistrationInput
): ValidatedRegistrationData => {
  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const emailRaw = data.email?.trim();
  const password = data.password;
  const termsAccepted = data.termsAccepted;
  const termsVersion = data.termsVersion?.trim();
  const privacyVersion = data.privacyVersion?.trim();

  if (!firstName || !lastName || !emailRaw || !password) {
    throw new ValidationError("Missing required fields!");
  }

  if (termsAccepted !== true) {
    throw new ValidationError(
      "You must accept the Terms of Service and Privacy Policy to register."
    );
  }

  if (!termsVersion || !privacyVersion) {
    throw new ValidationError("Legal document versions are required.");
  }

  const emailNormalized = normalizeEmail(emailRaw);

  if (!emailRegex.test(emailNormalized)) {
    throw new ValidationError("Invalid email format!");
  }

  validatePasswordStrength(password, {
    firstName,
    lastName,
    email: emailNormalized,
  });

  return {
    firstName,
    lastName,
    email: emailRaw,
    emailNormalized,
    password,
    termsVersion,
    privacyVersion,
  };
};

export const validateCarrierOnboardingData = (
  data: CarrierOnboardingInput
): ValidatedCarrierOnboardingData => {
  const phone_number = data.phone_number?.trim();
  const country = data.country?.trim();
  const shopName = data.shopName?.trim();

  if (!phone_number || !country) {
    throw new ValidationError("Missing required fields!");
  }

  if (country.length < 2) {
    throw new ValidationError("Invalid country!");
  }

  return {
    phone_number,
    country,
    ...(shopName ? { shopName } : {}),
  };
};

/** ---------- OTP Core (scoped) ---------- */

const checkOtpRestrictionsScoped = async (scope: OtpScope, emailKey: string) => {
  // Lock actif (suite à des échecs répétés)
  const lockTtl = await redis.ttl(keys.otpLock(scope, emailKey));
  if (lockTtl > 0) {
    throw new ValidationError(
      `Account temporarily locked. Try again in ${formatLockDuration(lockTtl)}.`,
      {
        type: "otp",
        locked: true,
        lockUntilSeconds: lockTtl,
      } satisfies OtpErrorDetails
    );
  }

  // Lock anti-spam (trop de demandes de resend)
  if (await redis.get(keys.otpSpamLock(scope, emailKey))) {
    throw new ValidationError(
      "Too many OTP requests! Please wait 1 hour before requesting again."
    );
  }

  // Cooldown entre 2 envois
  if (await redis.get(keys.otpCooldown(scope, emailKey))) {
    throw new ValidationError("Please wait 1 minute before requesting a new OTP!");
  }
};

const trackOtpRequestsScoped = async (scope: OtpScope, emailKey: string) => {
  const countKey = keys.otpRequestCount(scope, emailKey);
  const current = Number.parseInt((await redis.get(countKey)) || "0", 10);

  if (current >= OTP_MAX_REQUESTS_PER_WINDOW - 1) {
    await redis.set(
      keys.otpSpamLock(scope, emailKey),
      "locked",
      "EX",
      OTP_SPAM_LOCK_SECONDS
    );
    throw new ValidationError(
      "Too many OTP requests. Please wait 1 hour before requesting again."
    );
  }

  await redis.set(countKey, String(current + 1), "EX", OTP_REQUEST_WINDOW_SECONDS);
};

const sendOtpScoped = async (
  scope: OtpScope,
  firstName: string,
  emailKey: string,
  template: string,
  subject: string
) => {
  // 🔒 OTP 6 chiffres (standard 2026)
  const otp = crypto.randomInt(100000, 1000000).toString();
  await sendEmail(emailKey, subject, template, { firstName, otp });
  await redis.set(keys.otp(scope, emailKey), otp, "EX", OTP_TTL_SECONDS);
  await redis.set(
    keys.otpCooldown(scope, emailKey),
    "true",
    "EX",
    OTP_COOLDOWN_SECONDS
  );
};

/**
 * Vérifie un OTP avec exponential backoff Yamba.
 *
 * Barème :
 *  - 1er-2ème échec : pas de pénalité (warning visuel front uniquement)
 *  - 3ème : 1 min lock
 *  - 4ème : 5 min lock
 *  - 5ème : 30 min lock
 *  - 6ème+ : 24h lock + email d'alerte sécurité
 *
 * Le compteur d'échecs persiste 24h. Le resend ne reset PAS le compteur (Option B - sécurité Stripe).
 */
const verifyOtpScoped = async (scope: OtpScope, emailKey: string, otp: string) => {
  // 1. Vérifier si lock actif
  const existingLockTtl = await redis.ttl(keys.otpLock(scope, emailKey));
  if (existingLockTtl > 0) {
    throw new ValidationError(
      `Account temporarily locked. Try again in ${formatLockDuration(existingLockTtl)}.`,
      {
        type: "otp",
        locked: true,
        lockUntilSeconds: existingLockTtl,
      } satisfies OtpErrorDetails
    );
  }

  // 2. Récupérer l'OTP attendu
  const storedOtp = await redis.get(keys.otp(scope, emailKey));
  if (!storedOtp) {
    throw new ValidationError("Code expired. Please request a new one.", {
      type: "otp",
      locked: false,
    } satisfies OtpErrorDetails);
  }

  // 3. Comparer
  if (storedOtp === otp) {
    // Succès : on nettoie tout
    await redis.del(
      keys.otp(scope, emailKey),
      keys.otpAttempts(scope, emailKey),
      keys.otpSecurityAlerted(scope, emailKey)
    );
    return;
  }

  // 4. Échec : incrémenter le compteur (TTL 24h)
  const attemptsKey = keys.otpAttempts(scope, emailKey);
  const previousAttempts = Number.parseInt((await redis.get(attemptsKey)) || "0", 10);
  const currentAttempt = previousAttempts + 1;

  await redis.set(attemptsKey, String(currentAttempt), "EX", OTP_FAILED_COUNTER_TTL);

  // 5. Calculer la durée de lock selon le palier
  const lockDuration = getLockDurationForAttempt(currentAttempt);

  if (lockDuration > 0) {
    await redis.set(keys.otpLock(scope, emailKey), "locked", "EX", lockDuration);

    // 6. Alerte sécurité au 6ème échec (une seule fois par session)
    if (currentAttempt >= 6) {
      await maybeSendSecurityAlert(scope, emailKey);
    }

    throw new ValidationError(
      `Incorrect code. Account locked for ${formatLockDuration(lockDuration)}.`,
      {
        type: "otp",
        locked: true,
        lockUntilSeconds: lockDuration,
      } satisfies OtpErrorDetails
    );
  }

  // 7. Pas de lock encore : informer du nombre de tentatives restantes avant lock
  const attemptsBeforeLock = 2 - currentAttempt;

  throw new ValidationError(
    `Incorrect code. ${attemptsBeforeLock} attempt(s) left before temporary lock.`,
    {
      type: "otp",
      attemptsLeft: attemptsBeforeLock,
      locked: false,
    } satisfies OtpErrorDetails
  );
};

/**
 * Envoie un email d'alerte sécurité au 6ème échec OTP.
 * Une seule alerte par session de tentatives (pour ne pas spammer).
 */
async function maybeSendSecurityAlert(scope: OtpScope, emailKey: string) {
  const alertedKey = keys.otpSecurityAlerted(scope, emailKey);
  const alreadySent = await redis.get(alertedKey);
  if (alreadySent) return;

  await redis.set(alertedKey, "1", "EX", OTP_FAILED_COUNTER_TTL);

  const isRegister = scope === "register";

  try {
    await sendEmail(
      emailKey,
      isRegister
        ? "Activité suspecte sur votre inscription Yamba"
        : "Activité suspecte sur votre compte Yamba",
      "security-alert-mail",
      {
        scope,
        scopeLabel: isRegister ? "inscription" : "réinitialisation de mot de passe",
        attemptCount: 6,
        lockDuration: "24 heures",
        supportEmail: "support@yamba.com",
      }
    );
  } catch (error) {
    console.error("[security-alert] Failed to send alert email:", error);
  }
}

// ─── Exports backward-compatible ──────────────────────────
export const checkOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("register", emailKey);

export const trackOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("register", emailKey);

export const sendOtp = async (firstName: string, emailKey: string, template: string) =>
  sendOtpScoped("register", firstName, emailKey, template, "Verify Your Email");

export const verifyOtp = async (emailKey: string, otp: string) =>
  verifyOtpScoped("register", emailKey, otp);

export const checkForgotPasswordOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("forgot", emailKey);

export const trackForgotPasswordOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("forgot", emailKey);

export const sendForgotPasswordOtp = async (
  firstName: string,
  emailKey: string,
  template: string
) => sendOtpScoped("forgot", firstName, emailKey, template, "Reset Your Password");

export const verifyForgotPasswordOtpCode = async (emailKey: string, otp: string) =>
  verifyOtpScoped("forgot", emailKey, otp);

/** ---------- Pending Registration ---------- */
export const storePendingRegistration = async (
  emailKey: string,
  payload: PendingRegistration
) => {
  await redis.set(
    keys.pendingUser(emailKey),
    JSON.stringify(payload),
    "EX",
    PENDING_REG_TTL_SECONDS
  );
};

export const getPendingRegistration = async (
  emailKey: string
): Promise<PendingRegistration | null> => {
  const raw = await redis.get(keys.pendingUser(emailKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    await redis.del(keys.pendingUser(emailKey));
    return null;
  }
};

export const deletePendingRegistration = async (emailKey: string) => {
  await redis.del(keys.pendingUser(emailKey));
};

/** ---------- Verification Token ---------- */
export const createVerificationToken = () => crypto.randomBytes(32).toString("hex");

export const storeVerificationToken = async (token: string, emailKey: string) => {
  await redis.set(keys.verifyToken(token), emailKey, "EX", VERIFY_TOKEN_TTL_SECONDS);
};

export const getEmailKeyFromToken = async (token: string) => {
  const emailKey = await redis.get(keys.verifyToken(token));
  if (!emailKey) {
    throw new ValidationError(
      "Verification session expired or invalid. Please register again."
    );
  }
  return emailKey;
};

export const deleteVerificationToken = async (token: string) => {
  await redis.del(keys.verifyToken(token));
};

/** ---------- Forgot Password Reset Token ---------- */
export const createPasswordResetToken = () => crypto.randomBytes(32).toString("hex");

export const storePasswordResetToken = async (token: string, emailKey: string) => {
  await redis.set(
    keys.passwordResetToken(token),
    emailKey,
    "EX",
    PASSWORD_RESET_TOKEN_TTL_SECONDS
  );
};

export const consumePasswordResetToken = async (token: string) => {
  const emailKey = await redis.get(keys.passwordResetToken(token));
  if (!emailKey) {
    throw new ValidationError(
      "Password reset session expired or invalid. Please retry."
    );
  }
  await redis.del(keys.passwordResetToken(token));
  return emailKey;
};

/** ---------- Refresh token rotation ---------- */
export const createRefreshJti = () => crypto.randomBytes(16).toString("hex");

export const storeRefreshJti = async (
  userId: string,
  jti: string,
  rememberMe = false
) => {
  const ttl = rememberMe ? 30 * 24 * 60 * 60 : REFRESH_JTI_TTL_SECONDS;
  await redis.set(`refresh_jti:${userId}:${jti}`, "1", "EX", ttl);
};

export const hasRefreshJti = async (userId: string, jti: string): Promise<boolean> => {
  const exists = await redis.get(`refresh_jti:${userId}:${jti}`);
  return exists !== null;
};

export const revokeRefreshJti = async (userId: string, jti?: string) => {
  if (jti) {
    await redis.del(`refresh_jti:${userId}:${jti}`);
  } else {
    const pattern = `refresh_jti:${userId}:*`;
    let cursor = "0";
    do {
      const [nextCursor, matchedKeys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (matchedKeys.length > 0) {
        await redis.del(...matchedKeys);
      }
    } while (cursor !== "0");
  }
};

/** ---------- Email helpers ---------- */
type PasswordChangedEmailPayload = {
  firstName?: string;
  name?: string;
  changedAt?: string;
  ip?: string;
  userAgent?: string;
  securityUrl?: string;
};

export const sendPasswordChangedEmail = async (
  firstName: string | undefined,
  emailKey: string,
  payload?: Omit<PasswordChangedEmailPayload, "firstName">
) => {
  return sendEmail(
    emailKey,
    "Mot de passe modifié - Yamba",
    "password-changed-mail",
    { firstName, ...(payload ?? {}) }
  );
};

type AccountCreatedEmailPayload = {
  firstName?: string;
  loginUrl?: string;
  supportEmail?: string;
};

export const sendAccountCreatedEmail = async (
  firstName: string | undefined,
  emailKey: string,
  payload?: Omit<AccountCreatedEmailPayload, "firstName">
) => {
  return sendEmail(
    emailKey,
    "Bienvenue sur Yamba 🎉",
    "account-created-mail",
    {
      firstName,
      loginUrl: payload?.loginUrl,
      supportEmail: payload?.supportEmail ?? "support@yamba.com",
    }
  );
};
