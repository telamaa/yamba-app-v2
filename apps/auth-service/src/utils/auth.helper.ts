// auth.helper.ts
import { ValidationError } from "@packages/error-handler";
import crypto from "node:crypto";
import redis from "@packages/libs/redis";
import { sendEmail } from "./sendMail";

/** ---------- Constants ---------- */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_COOLDOWN_SECONDS = 60; // 1 minute
const OTP_REQUEST_WINDOW_SECONDS = 3600; // 1 hour
const OTP_SPAM_LOCK_SECONDS = 3600; // 1 hour
const OTP_MAX_REQUESTS_PER_WINDOW = 6; // lock on 5rd attempt (see logic)
const OTP_MAX_FAILED_ATTEMPTS = 6; // lock on 3rd failure
const OTP_ACCOUNT_LOCK_SECONDS = 1800; // 30 minutes

const PENDING_REG_TTL_SECONDS = 900; // 15 minutes
const VERIFY_TOKEN_TTL_SECONDS = 900; // 15 minutes (>= OTP TTL)

// Forgot password
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 900; // 15 minutes

// Refresh rotation (single-session by default)
const REFRESH_JTI_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** ---------- Types ---------- */
export type GenderInput = "MALE" | "FEMALE" | "OTHER";

export type RegistrationInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  gender?: GenderInput | string;
};

export type ValidatedRegistrationData = {
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  password: string;
  gender: GenderInput;
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
  gender: GenderInput;
  passwordHash: string;
};

type OtpScope = "register" | "forgot";

/** ---------- Redis Keys ---------- */
const keys = {
  // scoped OTP (avoid collisions between register and forgot)
  otp: (scope: OtpScope, emailKey: string) => `otp:${scope}:${emailKey}`,
  otpCooldown: (scope: OtpScope, emailKey: string) => `otp_cooldown:${scope}:${emailKey}`,
  otpSpamLock: (scope: OtpScope, emailKey: string) => `otp_spam_lock:${scope}:${emailKey}`,
  otpLock: (scope: OtpScope, emailKey: string) => `otp_lock:${scope}:${emailKey}`,
  otpAttempts: (scope: OtpScope, emailKey: string) => `otp_attempts:${scope}:${emailKey}`,
  otpRequestCount: (scope: OtpScope, emailKey: string) => `otp_request_count:${scope}:${emailKey}`,

  pendingUser: (emailKey: string) => `pending_user:${emailKey}`,
  verifyToken: (token: string) => `verify_token:${token}`,

  // forgot password
  passwordResetToken: (token: string) => `pwd_reset_token:${token}`,

  // refresh rotation (single active refresh token per user)
  refreshJti: (userId: string) => `refresh_jti:${userId}`,
};

/** ---------- Utils ---------- */
const isValidGender = (g: unknown): g is GenderInput =>
  g === "MALE" || g === "FEMALE" || g === "OTHER";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** ---------- Validation ---------- */
export const validateRegistrationData = (data: RegistrationInput): ValidatedRegistrationData => {
  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const emailRaw = data.email?.trim();
  const password = data.password;
  const gender = data.gender;

  if (!firstName || !lastName || !emailRaw || !password || !gender) {
    throw new ValidationError("Missing required fields!");
  }

  const emailNormalized = normalizeEmail(emailRaw);

  if (!emailRegex.test(emailNormalized)) {
    throw new ValidationError("Invalid email format!");
  }

  if (password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters long!");
  }

  if (!isValidGender(gender)) {
    throw new ValidationError("Invalid gender value!");
  }

  return {
    firstName,
    lastName,
    email: emailRaw,
    emailNormalized,
    password,
    gender,
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
  if (await redis.get(keys.otpLock(scope, emailKey))) {
    throw new ValidationError(
      "Account locked due to multiple failed attempt! Try again after 30 minutes"
    );
  }

  if (await redis.get(keys.otpSpamLock(scope, emailKey))) {
    throw new ValidationError("Too many OTP requests! Please wait 1 hour before requesting again.");
  }

  if (await redis.get(keys.otpCooldown(scope, emailKey))) {
    throw new ValidationError("Please wait 1 minute before requesting a new OTP!");
  }
};

const trackOtpRequestsScoped = async (scope: OtpScope, emailKey: string) => {
  const countKey = keys.otpRequestCount(scope, emailKey);
  const current = Number.parseInt((await redis.get(countKey)) || "0", 10);

  // allow 5 requests, lock on 5rd
  if (current >= OTP_MAX_REQUESTS_PER_WINDOW - 1) {
    await redis.set(keys.otpSpamLock(scope, emailKey), "locked", "EX", OTP_SPAM_LOCK_SECONDS);
    throw new ValidationError("Too many OTP requests. Please wait 1 hour before requesting again.");
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
  const otp = crypto.randomInt(1000, 10000).toString(); // 1000..9999
  await sendEmail(emailKey, subject, template, { firstName, otp });

  await redis.set(keys.otp(scope, emailKey), otp, "EX", OTP_TTL_SECONDS);
  await redis.set(keys.otpCooldown(scope, emailKey), "true", "EX", OTP_COOLDOWN_SECONDS);
};

const verifyOtpScoped = async (scope: OtpScope, emailKey: string, otp: string) => {
  const storedOtp = await redis.get(keys.otp(scope, emailKey));
  if (!storedOtp) {
    throw new ValidationError("Invalid or expired OTP!");
  }

  const attemptsKey = keys.otpAttempts(scope, emailKey);
  const failedAttempts = Number.parseInt((await redis.get(attemptsKey)) || "0", 10);

  if (storedOtp !== otp) {
    const nextFailed = failedAttempts + 1;

    if (nextFailed >= OTP_MAX_FAILED_ATTEMPTS) {
      await redis.set(keys.otpLock(scope, emailKey), "locked", "EX", OTP_ACCOUNT_LOCK_SECONDS);
      await redis.del(keys.otp(scope, emailKey), attemptsKey);
      throw new ValidationError("Too many failed attempts. Your account is locked for 30 minutes!");
    }

    await redis.set(attemptsKey, String(nextFailed), "EX", OTP_TTL_SECONDS);

    const attemptsLeft = OTP_MAX_FAILED_ATTEMPTS - nextFailed;
    throw new ValidationError(`Incorrect OTP. ${attemptsLeft} attempt(s) left.`);
  }

  await redis.del(keys.otp(scope, emailKey), attemptsKey);
};

/**
 * Backward compatible exports for REGISTER flow:
 * - keep your controller calls unchanged
 */
export const checkOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("register", emailKey);

export const trackOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("register", emailKey);

export const sendOtp = async (firstName: string, emailKey: string, template: string) =>
  sendOtpScoped("register", firstName, emailKey, template, "Verify Your Email");

export const verifyOtp = async (emailKey: string, otp: string) =>
  verifyOtpScoped("register", emailKey, otp);

/**
 * FORGOT PASSWORD exports
 */
export const checkForgotPasswordOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("forgot", emailKey);

export const trackForgotPasswordOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("forgot", emailKey);

export const sendForgotPasswordOtp = async (firstName: string, emailKey: string, template: string) =>
  sendOtpScoped("forgot", firstName, emailKey, template, "Reset Your Password");

export const verifyForgotPasswordOtpCode = async (emailKey: string, otp: string) =>
  verifyOtpScoped("forgot", emailKey, otp);

/** ---------- Pending Registration ---------- */
export const storePendingRegistration = async (emailKey: string, payload: PendingRegistration) => {
  await redis.set(keys.pendingUser(emailKey), JSON.stringify(payload), "EX", PENDING_REG_TTL_SECONDS);
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

/** ---------- Verification Token (opaque) ---------- */
export const createVerificationToken = () => crypto.randomBytes(32).toString("hex");

export const storeVerificationToken = async (token: string, emailKey: string) => {
  await redis.set(keys.verifyToken(token), emailKey, "EX", VERIFY_TOKEN_TTL_SECONDS);
};

export const getEmailKeyFromToken = async (token: string) => {
  const emailKey = await redis.get(keys.verifyToken(token));
  if (!emailKey) {
    throw new ValidationError("Verification session expired or invalid. Please register again.");
  }
  return emailKey;
};

export const deleteVerificationToken = async (token: string) => {
  await redis.del(keys.verifyToken(token));
};

/** ---------- Forgot Password Reset Token (opaque, one-shot) ---------- */
export const createPasswordResetToken = () => crypto.randomBytes(32).toString("hex");

export const storePasswordResetToken = async (token: string, emailKey: string) => {
  await redis.set(keys.passwordResetToken(token), emailKey, "EX", PASSWORD_RESET_TOKEN_TTL_SECONDS);
};

export const consumePasswordResetToken = async (token: string) => {
  const emailKey = await redis.get(keys.passwordResetToken(token));
  if (!emailKey) {
    throw new ValidationError("Password reset session expired or invalid. Please retry.");
  }
  await redis.del(keys.passwordResetToken(token)); // one-shot
  return emailKey;
};

/** ---------- Refresh token rotation (single active session) ---------- */
export const createRefreshJti = () => crypto.randomBytes(16).toString("hex");

export const storeRefreshJti = async (userId: string, jti: string) => {
  await redis.set(keys.refreshJti(userId), jti, "EX", REFRESH_JTI_TTL_SECONDS);
};

export const getRefreshJti = async (userId: string) => {
  return redis.get(keys.refreshJti(userId));
};

export const revokeRefreshJti = async (userId: string) => {
  await redis.del(keys.refreshJti(userId));
};


// send password change email
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
    "password-changed-mail", // <-- ton fichier EJS: password-changed-mail.ejs
    {
      firstName,
      ...(payload ?? {}),
    }
  );
};
