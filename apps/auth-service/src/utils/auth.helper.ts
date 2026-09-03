// auth.helper.ts
import { ValidationError } from "@packages/error-handler";
import crypto from "node:crypto";
import redis from "@packages/libs/redis";
import { sendAuthEmail } from "../emails/send-auth-email";
import { getAuthEmails } from "../emails/auth-emails";
import { resolveLocale } from "@packages/api-contracts";
import { getOtpFailurePolicy, formatLockDuration } from "./otp-policy";
import { validatePasswordStrength } from "./password-rules";

// Ré-exports : les contrôleurs continuent d'importer depuis auth.helper.
export { validatePasswordStrength };
export type {
  PasswordValidationContext,
  PasswordRuleCode,
  PasswordErrorDetails,
} from "./password-rules";
import {
  loadSessionPolicy,
  computeSessionTtlSeconds,
} from "./session-policy";

/** ---------- Constants ---------- */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// OTP lifecycle
const OTP_TTL_SECONDS = 600;                 // 10 min (était 5 min, aligné avec OTP 6 chiffres)
/** Durée affichée dans les emails OTP — TOUJOURS dérivée du TTL réel (recette 03/09 : « 5 minutes » en dur vs 10 réelles). */
export const OTP_TTL_MINUTES = OTP_TTL_SECONDS / 60;
const OTP_COOLDOWN_SECONDS = 60;             // Entre 2 demandes d'OTP
const OTP_REQUEST_WINDOW_SECONDS = 3600;     // Fenêtre 1h pour rate limiting des resend
const OTP_SPAM_LOCK_SECONDS = 3600;          // Lock anti-spam 1h
const OTP_MAX_REQUESTS_PER_WINDOW = 6;       // Max 6 resend par heure

// Compteur d'échecs : durée 24h (matche le palier max)
const OTP_FAILED_COUNTER_TTL = 86400;

// Pending registration & verify token
// 30 min (était 15) : doit couvrir l'OTP (10 min) + au moins un renvoi, et le
// renvoi PROLONGE la fenêtre (refreshPendingRegistration) — recette 03/09.
const PENDING_REG_TTL_SECONDS = 1800;
const VERIFY_TOKEN_TTL_SECONDS = 900;

// Forgot password
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 900;

// Refresh tokens — les TTL sont désormais calculés par session-policy.ts
// (D27 : min(fenêtre d'inactivité, vie absolue restante)).

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
  /** D44 — locale résolue à l'inscription (x-locale), copiée sur User.preferredLocale. */
  preferredLocale?: string;
};

type OtpScope = "register" | "forgot";

/**
 * Type du contexte enrichi pour les erreurs OTP.
 * Transmis via le paramètre `details` de ValidationError (type « safe »,
 * exposé même en production par error-middleware).
 *
 * Le frontend construit SES messages (dans la langue de l'utilisateur) à
 * partir de `code`, `attemptsLeft` et `lockUntilSeconds` — jamais à partir
 * du `message` anglais de l'API.
 */
export type OtpErrorCode =
  | "OTP_INCORRECT"
  | "OTP_INVALIDATED"
  | "OTP_LOCKED"
  | "OTP_EXPIRED";

export type OtpErrorDetails = {
  type: "otp";
  code: OtpErrorCode;
  /** Essais restants avant le prochain palier (voir otp-policy.ts). */
  attemptsLeft?: number;
  locked: boolean;
  lockUntilSeconds?: number;
  /** Le code saisi ne sera plus jamais accepté : il faut en redemander un. */
  otpInvalidated?: boolean;
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

/** ---------- Validation ---------- */

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
        code: "OTP_LOCKED",
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
  locale: string | null | undefined
) => {
  // 🔒 OTP 6 chiffres (standard 2026)
  const otp = crypto.randomInt(100000, 1000000).toString();
  const emails = getAuthEmails(locale);
  const params = { firstName, otp, expiresInMinutes: OTP_TTL_MINUTES };
  const email = scope === "register" ? emails.verifyEmail(params) : emails.resetPassword(params);
  await sendAuthEmail(emailKey, locale, email);
  await redis.set(keys.otp(scope, emailKey), otp, "EX", OTP_TTL_SECONDS);
  await redis.set(
    keys.otpCooldown(scope, emailKey),
    "true",
    "EX",
    OTP_COOLDOWN_SECONDS
  );
};

/**
 * Vérifie un OTP avec le barème par paliers de Yamba (otp-policy.ts) :
 *  - échecs 1 → 4 : essais restants annoncés, pas de verrou
 *  - 5e : code invalidé + 1 min · 10e : invalidé + 30 min + alerte · 15e+ : invalidé + 24 h
 *
 * Le compteur d'échecs persiste 24 h. Le renvoi ne remet PAS le compteur à zéro
 * (sécurité) — il fournit seulement un nouveau code.
 */
const verifyOtpScoped = async (
  scope: OtpScope,
  emailKey: string,
  otp: string,
  locale: string | null | undefined
) => {
  // 1. Vérifier si lock actif
  const existingLockTtl = await redis.ttl(keys.otpLock(scope, emailKey));
  if (existingLockTtl > 0) {
    throw new ValidationError(
      `Account temporarily locked. Try again in ${formatLockDuration(existingLockTtl)}.`,
      {
        type: "otp",
        code: "OTP_LOCKED",
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
      code: "OTP_EXPIRED",
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

  // 4. Échec : incrémenter le compteur cumulé (TTL 24h, jamais remis à zéro par un renvoi)
  const attemptsKey = keys.otpAttempts(scope, emailKey);
  const previousAttempts = Number.parseInt((await redis.get(attemptsKey)) || "0", 10);
  const currentAttempt = previousAttempts + 1;

  await redis.set(attemptsKey, String(currentAttempt), "EX", OTP_FAILED_COUNTER_TTL);

  // 5. Politique du palier (otp-policy.ts) : verrou ? code invalidé ? alerte ?
  const policy = getOtpFailurePolicy(currentAttempt);

  if (policy.invalidateOtp) {
    // Le code courant ne sera plus jamais accepté : brute-force impossible
    // au-delà de 5 essais sur un même code. L'utilisateur en redemande un
    // (cooldown 60 s) une fois le verrou levé.
    await redis.del(keys.otp(scope, emailKey));
  }

  if (policy.lockSeconds > 0) {
    await redis.set(keys.otpLock(scope, emailKey), "locked", "EX", policy.lockSeconds);

    if (policy.securityAlert) {
      await maybeSendSecurityAlert(scope, emailKey, locale, currentAttempt, policy.lockSeconds);
    }

    throw new ValidationError(
      `Incorrect code. This code is no longer valid — request a new one in ${formatLockDuration(policy.lockSeconds)}.`,
      {
        type: "otp",
        code: "OTP_INVALIDATED",
        locked: true,
        lockUntilSeconds: policy.lockSeconds,
        otpInvalidated: true,
        attemptsLeft: 0,
      } satisfies OtpErrorDetails
    );
  }

  // 6. Pas de palier atteint : informer du nombre d'essais restants
  throw new ValidationError(
    `Incorrect code. ${policy.attemptsLeft} attempt(s) left before this code is invalidated.`,
    {
      type: "otp",
      code: "OTP_INCORRECT",
      attemptsLeft: policy.attemptsLeft,
      locked: false,
    } satisfies OtpErrorDetails
  );
};

/**
 * Envoie un email d'alerte sécurité à partir du 10e échec OTP (palier 2, A50).
 * Une seule alerte par session de tentatives (pour ne pas spammer).
 */
async function maybeSendSecurityAlert(
  scope: OtpScope,
  emailKey: string,
  locale: string | null | undefined,
  attemptCount: number,
  lockSeconds: number
) {
  const alertedKey = keys.otpSecurityAlerted(scope, emailKey);
  const alreadySent = await redis.get(alertedKey);
  if (alreadySent) return;

  await redis.set(alertedKey, "1", "EX", OTP_FAILED_COUNTER_TTL);

  await sendAuthEmail(
    emailKey,
    locale,
    getAuthEmails(locale).securityAlert({
      scope,
      attemptCount,
      lockSeconds,
      supportEmail: "support@yamba.com",
    })
  );
}

// ─── Exports backward-compatible ──────────────────────────
export const checkOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("register", emailKey);

export const trackOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("register", emailKey);

export const sendOtp = async (
  firstName: string,
  emailKey: string,
  locale: string | null | undefined
) => sendOtpScoped("register", firstName, emailKey, locale);

export const verifyOtp = async (
  emailKey: string,
  otp: string,
  locale: string | null | undefined
) => verifyOtpScoped("register", emailKey, otp, locale);

export const checkForgotPasswordOtpRestrictions = async (emailKey: string) =>
  checkOtpRestrictionsScoped("forgot", emailKey);

export const trackForgotPasswordOtpRequests = async (emailKey: string) =>
  trackOtpRequestsScoped("forgot", emailKey);

export const sendForgotPasswordOtp = async (
  firstName: string,
  emailKey: string,
  locale: string | null | undefined
) => sendOtpScoped("forgot", firstName, emailKey, locale);

export const verifyForgotPasswordOtpCode = async (
  emailKey: string,
  otp: string,
  locale: string | null | undefined
) => verifyOtpScoped("forgot", emailKey, otp, locale);

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

/**
 * Prolonge la fenêtre d'inscription en attente (appelé à chaque renvoi d'OTP) :
 * sans cela, un code renvoyé à la 10e minute restait valable jusqu'à la 20e
 * alors que l'inscription mourait à la 15e (« session expirée » avec un code
 * valide en main — recette 03/09).
 */
export const refreshPendingRegistration = async (emailKey: string) => {
  await redis.expire(keys.pendingUser(emailKey), PENDING_REG_TTL_SECONDS);
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

/** ---------- Refresh token rotation (D27 — SES-01/SES-02) ---------- */
export const createRefreshJti = () => crypto.randomBytes(16).toString("hex");

/**
 * Record de session stocké en Redis (JSON) — remplace l'ancien "1".
 * `createdAt` est TRANSPORTÉ de rotation en rotation : c'est lui qui
 * borne la vie absolue (SES-02). `lastActivityAt` prépare SES-05
 * (liste des sessions actives dans le dashboard Sécurité).
 */
export type SessionRecord = {
  createdAt: number;      // epoch ms — création de la SESSION (pas du jti)
  lastActivityAt: number; // epoch ms — dernier refresh/login
  rememberMe: boolean;
};

/**
 * Crée/rotate une clé de session. TTL = min(fenêtre d'inactivité,
 * vie absolue restante depuis createdAt) : l'expiration Redis EST le
 * timeout d'inactivité, et la rotation ne peut jamais dépasser le
 * plafond absolu. Retourne le TTL posé (0 = session absolument
 * expirée, RIEN n'est écrit — l'appelant DOIT refuser).
 */
export const storeRefreshSession = async (
  userId: string,
  jti: string,
  rememberMe: boolean,
  createdAt: number = Date.now()
): Promise<number> => {
  const now = Date.now();
  const policy = loadSessionPolicy();
  const ttlSeconds = computeSessionTtlSeconds(createdAt, rememberMe, policy, now);
  if (ttlSeconds <= 0) return 0;

  const record: SessionRecord = { createdAt, lastActivityAt: now, rememberMe };
  await redis.set(
    `refresh_jti:${userId}:${jti}`,
    JSON.stringify(record),
    "EX",
    ttlSeconds
  );
  return ttlSeconds;
};

/**
 * Lit une session. Retours :
 * - SessionRecord : session au format D27
 * - "legacy"      : ancienne valeur "1" (pré-D27) — l'appelant migre
 *   (accepter-et-migrer : createdAt réinitialisé à now, une seule fois ;
 *   ce chemin sera supprimé dans une PR de cleanup quand les sessions
 *   pré-déploiement auront toutes expiré)
 * - null          : inexistante (expirée par inactivité/plafond, ou
 *   jti réutilisé — indistinguables)
 */
export const getRefreshSession = async (
  userId: string,
  jti: string
): Promise<SessionRecord | "legacy" | null> => {
  const raw = await redis.get(`refresh_jti:${userId}:${jti}`);
  if (raw === null) return null;
  if (raw === "1") return "legacy";
  try {
    const parsed = JSON.parse(raw) as SessionRecord;
    if (
      typeof parsed?.createdAt === "number" &&
      typeof parsed?.lastActivityAt === "number" &&
      typeof parsed?.rememberMe === "boolean"
    ) {
      return parsed;
    }
    return "legacy"; // valeur inattendue : traitée comme legacy (migrée)
  } catch {
    return "legacy";
  }
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

/** ---------- Email helpers (D44 : locale du destinataire) ---------- */
type PasswordChangedEmailPayload = {
  changedAt?: string;
  ip?: string;
  userAgent?: string;
  securityUrl?: string;
};

export const sendPasswordChangedEmail = async (
  firstName: string | undefined,
  emailKey: string,
  locale: string | null | undefined,
  payload?: PasswordChangedEmailPayload
) => {
  return sendAuthEmail(
    emailKey,
    locale,
    getAuthEmails(locale).passwordChanged({
      firstName,
      ...(payload ?? {}),
      supportEmail: "support@yamba.com",
    })
  );
};

type AccountCreatedEmailPayload = {
  loginUrl?: string;
  supportEmail?: string;
};

export const sendAccountCreatedEmail = async (
  firstName: string | undefined,
  emailKey: string,
  locale: string | null | undefined,
  payload?: AccountCreatedEmailPayload
) => {
  return sendAuthEmail(
    emailKey,
    locale,
    getAuthEmails(locale).accountCreated({
      firstName,
      loginUrl: payload?.loginUrl,
      supportEmail: payload?.supportEmail ?? "support@yamba.com",
    })
  );
};

/** Locale d'une requête HTTP (x-locale, sinon Accept-Language) — résolue. */
export const localeFromHeaders = (headers: Record<string, unknown>): string => {
  const x = headers["x-locale"];
  if (typeof x === "string" && x) return resolveLocale(x);
  const accept = headers["accept-language"];
  return resolveLocale(typeof accept === "string" ? accept : undefined);
};
