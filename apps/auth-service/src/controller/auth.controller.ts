import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { AuthError, ValidationError } from "@packages/error-handler";
import { isSupportedLocale, resolveLocale } from "@packages/api-contracts";

import {
  checkForgotPasswordOtpRestrictions,
  checkOtpRestrictions,
  consumePasswordResetToken,
  createPasswordResetToken,
  createRefreshJti,
  createVerificationToken,
  deletePendingRegistration,
  deleteVerificationToken,
  getEmailKeyFromToken,
  getPendingRegistration,
  getRefreshSession,
  normalizeEmail,
  revokeRefreshJti,
  sendAccountCreatedEmail,
  sendForgotPasswordOtp,
  sendOtp,
  sendPasswordChangedEmail,
  storePasswordResetToken,
  storePendingRegistration,
  refreshPendingRegistration,
  localeFromHeaders,
  storeRefreshSession,
  storeVerificationToken,
  trackForgotPasswordOtpRequests,
  trackOtpRequests,
  validatePasswordStrength,
  validateRegistrationData,
  verifyForgotPasswordOtpCode,
  verifyOtp,
} from "../utils/auth.helper";
// D27 — politique de session (SES-01 inactivité / SES-02 vie absolue)
import {
  loadSessionPolicy,
  isAbsoluteExpired,
  remainingLifetimeMs,
} from "../utils/session-policy";
import { recordRegistrationConsents } from "../utils/consent/consent.helper";
import { clearAuthCookies, setCookie } from "../utils/cookies/setCookie";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";

// ✨ NEW — Helper pour la génération du slug public à l'inscription
import { generateUniquePublicSlug } from "../utils/slug.helper";

// ───────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────

function getClientIp(req: Request): string | undefined {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim();
  }
  return req.ip;
}

function getClientLocale(req: Request): string | undefined {
  const headerLocale = req.headers["x-locale"];
  if (typeof headerLocale === "string") return headerLocale;

  const acceptLang = req.headers["accept-language"];
  if (typeof acceptLang === "string") {
    return acceptLang.split(",")[0]?.split("-")[0]?.toLowerCase();
  }
  return undefined;
}

// ───────────────────────────────────────────────────────
// REGISTER
// ───────────────────────────────────────────────────────

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateRegistrationData(req.body);
    const emailKey = data.emailNormalized;

    const existingUser = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });
    if (existingUser) {
      return next(
        new ValidationError("User already exists with this email!", {
          type: "register",
          code: "EMAIL_ALREADY_USED",
          field: "email",
        })
      );
    }

    await checkOtpRestrictions(emailKey);
    await trackOtpRequests(emailKey);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const consentIp = getClientIp(req);
    const consentUserAgent = req.headers["user-agent"];
    const consentLocale = getClientLocale(req);
    // D44 — la langue de l'interface au moment de l'inscription devient la
    // langue de l'utilisateur (emails), modifiable ensuite via PATCH /auth/me/locale.
    const preferredLocale = resolveLocale(consentLocale);

    await storePendingRegistration(emailKey, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      emailNormalized: data.emailNormalized,
      passwordHash,
      termsVersion: data.termsVersion,
      privacyVersion: data.privacyVersion,
      consentIp,
      consentUserAgent: typeof consentUserAgent === "string" ? consentUserAgent : undefined,
      consentLocale,
      preferredLocale,
    });

    await sendOtp(data.firstName, emailKey, preferredLocale);

    const verificationToken = createVerificationToken();
    await storeVerificationToken(verificationToken, emailKey);

    return res.status(200).json({
      message: "OTP sent to email. Please verify your account.",
      verificationToken,
    });
  } catch (error) {
    return next(error);
  }
};

export const resendRegistrationOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationToken } = req.body as { verificationToken?: string };

    if (!verificationToken) {
      return next(new ValidationError("verificationToken is required!"));
    }

    const token = String(verificationToken);
    const emailKey = await getEmailKeyFromToken(token);

    const pending = await getPendingRegistration(emailKey);
    if (!pending) {
      return next(
        new ValidationError("Registration session expired. Please register again.")
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });
    if (existingUser) {
      return next(
        new ValidationError("User already exists with this email!", {
          type: "register",
          code: "EMAIL_ALREADY_USED",
          field: "email",
        })
      );
    }

    await checkOtpRestrictions(emailKey);
    await trackOtpRequests(emailKey);

    await sendOtp(pending.firstName, emailKey, pending.preferredLocale ?? localeFromHeaders(req.headers));
    // Le renvoi PROLONGE la fenêtre d'inscription (sinon : code valide, session morte)
    await refreshPendingRegistration(emailKey);

    return res.status(200).json({
      message: "OTP sent again.",
      verificationToken: token,
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// 🆕 CANCEL REGISTRATION
// ───────────────────────────────────────────────────────
// Permet à l'utilisateur d'annuler sa session pending et de
// recommencer proprement (ex: trompé d'email).
//
// Cleanup complet :
// 1. Supprime le pending Redis
// 2. Invalide le verificationToken
//
// Note : le compteur d'échecs OTP (otp_attempts) n'est PAS reset
// pour empêcher un attaquant de "réinitialiser" sa session après
// avoir épuisé les tentatives.

export const cancelRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationToken } = req.body as { verificationToken?: string };

    if (!verificationToken) {
      return next(new ValidationError("verificationToken is required!"));
    }

    const token = String(verificationToken);

    // Tenter de retrouver l'email associé pour le cleanup
    try {
      const emailKey = await getEmailKeyFromToken(token);
      await deletePendingRegistration(emailKey);
    } catch {
      // Token déjà expiré : on continue, c'est OK
    }

    // Toujours supprimer le verificationToken
    await deleteVerificationToken(token);

    return res.status(200).json({
      success: true,
      message: "Registration cancelled.",
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// VERIFY REGISTRATION OTP
// ───────────────────────────────────────────────────────

export const verifyRegistrationOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationToken, otp } = req.body;

    if (!verificationToken || !otp) {
      return next(new ValidationError("verificationToken and OTP are required!"));
    }

    const token = String(verificationToken);
    const emailKey = await getEmailKeyFromToken(token);

    // L'alerte sécurité (10e échec) part dans la langue de la requête ;
    // l'inscription elle-même n'est lue qu'après un code correct.
    await verifyOtp(emailKey, String(otp), localeFromHeaders(req.headers));

    const pending = await getPendingRegistration(emailKey);
    if (!pending) {
      return next(
        new ValidationError("Registration session expired. Please register again.")
      );
    }
    const registrationLocale = pending.preferredLocale ?? localeFromHeaders(req.headers);

    const existingUser = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });
    if (existingUser) {
      return next(
        new ValidationError("User already exists with this email!", {
          type: "register",
          code: "EMAIL_ALREADY_USED",
          field: "email",
        })
      );
    }

    // ✨ NEW — Génération du slug public AVANT la transaction.
    // La vérif d'unicité est hors transaction pour ne pas allonger le lock,
    // et le slug est immuable une fois généré (pas de race condition possible).
    const publicSlug = await generateUniquePublicSlug(
      pending.firstName,
      pending.lastName
    );

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: pending.firstName,
          lastName: pending.lastName,
          email: pending.email,
          emailNormalized: pending.emailNormalized,
          passwordHash: pending.passwordHash,
          publicSlug, // ✨ NEW — Slug public unique pour /u/[slug]
          preferredLocale: resolveLocale(registrationLocale), // D44
        },
      });

      await recordRegistrationConsents(tx, user.id, {
        termsVersion: pending.termsVersion,
        privacyVersion: pending.privacyVersion,
        ipAddress: pending.consentIp,
        userAgent: pending.consentUserAgent,
        locale: pending.consentLocale,
      });
    });

    sendAccountCreatedEmail(pending.firstName, pending.emailNormalized, registrationLocale, {
      loginUrl: process.env.USER_APP_URL
        ? `${process.env.USER_APP_URL}/login`
        : undefined,
      supportEmail: "support@yamba.com",
    }).catch((err) => {
      console.error("Welcome email failed:", err);
    });

    await deletePendingRegistration(emailKey);
    await deleteVerificationToken(token);

    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// LOGIN, REFRESH, etc. — INCHANGÉS
// ───────────────────────────────────────────────────────

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, rememberMe } = req.body as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    };

    if (!email || !password) {
      return next(new ValidationError("Email and password are required!"));
    }

    const emailKey = normalizeEmail(String(email));
    const user = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });

    if (!user) return next(new AuthError("Invalid email or password"));

    const isMatch = await bcrypt.compare(String(password), user.passwordHash ?? "");
    if (!isMatch) return next(new AuthError("Invalid email or password"));

    const shouldRemember = Boolean(rememberMe);

    clearAuthCookies(res);

    const accessToken = jwt.sign(
      { id: user.id, roles: user.roles },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" }
    );

    // D27 — nouvelle session : createdAt = now, TTL = min(inactivité, vie absolue)
    const sessionCreatedAt = Date.now();
    const jti = createRefreshJti();
    await storeRefreshSession(user.id, jti, shouldRemember, sessionCreatedAt);

    // Le JWT refresh est borné à la vie absolue de la session (SES-02) —
    // plus jamais un "30d" plein pot re-signé à chaque rotation.
    const refreshLifetimeSeconds = Math.ceil(
      remainingLifetimeMs(sessionCreatedAt, shouldRemember, loadSessionPolicy(), sessionCreatedAt) / 1000
    );
    const refreshToken = jwt.sign(
      { id: user.id, jti, rememberMe: shouldRemember, sca: sessionCreatedAt },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: refreshLifetimeSeconds }
    );

    setCookie(res, "access_token", accessToken);
    setCookie(res, "refresh_token", refreshToken, { rememberMe: shouldRemember });

    return res.status(200).json({
      message: "Login successful!",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    });
  } catch (error) {
    return next(error);
  }
};

type RefreshPayload = {
  id: string;
  jti: string;
  rememberMe?: boolean;
  iat?: number;
  exp?: number;
};

export const refreshAuthTokens = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cookieToken = req.cookies?.["refresh_token"];
    const headerToken =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : undefined;

    const token = cookieToken || headerToken;
    if (!token) return next(new AuthError("Unauthorized! No refresh token."));

    let decoded: RefreshPayload;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as RefreshPayload;
    } catch {
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Invalid refresh token."));
    }

    if (!decoded?.id || !decoded?.jti) {
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Invalid refresh token payload."));
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! User not found."));
    }

    // D27 — lecture du record de session.
    // Clé absente = expirée (inactivité SES-01 / plafond SES-02) OU jti
    // réutilisé : indistinguables → message neutre.
    const session = await getRefreshSession(user.id, decoded.jti);
    if (session === null) {
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Session expired or invalid. Please log in again."));
    }

    const shouldRemember =
      session === "legacy" ? Boolean(decoded.rememberMe) : session.rememberMe;

    // Legacy "1" (pré-D27) : accepter-et-migrer — createdAt réinitialisé
    // à now (fenêtre absolue repart une seule fois pour ces sessions).
    // Chemin à supprimer en PR de cleanup une fois les sessions
    // pré-déploiement toutes expirées (≤ 30 j après mise en prod).
    const sessionCreatedAt =
      session === "legacy" ? Date.now() : session.createdAt;

    // SES-02 — plafond absolu (ceinture-bretelles : le TTL Redis le
    // garantit déjà, mais on revérifie applicativement).
    const policy = loadSessionPolicy();
    if (isAbsoluteExpired(sessionCreatedAt, shouldRemember, policy, Date.now())) {
      await revokeRefreshJti(user.id, decoded.jti);
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Session expired. Please log in again."));
    }

    await revokeRefreshJti(user.id, decoded.jti);

    const newAccessToken = jwt.sign(
      { id: user.id, roles: user.roles },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" }
    );

    // Rotation : nouveau jti, MÊME createdAt (c'est lui qui borne SES-02).
    const newJti = createRefreshJti();
    const ttlSet = await storeRefreshSession(
      user.id,
      newJti,
      shouldRemember,
      sessionCreatedAt
    );
    if (ttlSet <= 0) {
      // La vie absolue s'est éteinte entre le check et l'écriture (course
      // improbable) : rien n'a été écrit, on refuse proprement.
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Session expired. Please log in again."));
    }

    // JWT refresh borné à la vie absolue restante (plus jamais 30d plein pot).
    const refreshLifetimeSeconds = Math.ceil(
      remainingLifetimeMs(sessionCreatedAt, shouldRemember, policy, Date.now()) / 1000
    );
    const newRefreshToken = jwt.sign(
      { id: user.id, jti: newJti, rememberMe: shouldRemember, sca: sessionCreatedAt },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: refreshLifetimeSeconds }
    );

    setCookie(res, "access_token", newAccessToken);
    setCookie(res, "refresh_token", newRefreshToken, { rememberMe: shouldRemember });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// FORGOT PASSWORD
// ───────────────────────────────────────────────────────

export const requestPasswordResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return next(new ValidationError("Email is required!"));

    const emailKey = normalizeEmail(String(email));
    const user = await prisma.user.findUnique({ where: { emailNormalized: emailKey } });

    if (user) {
      await checkForgotPasswordOtpRestrictions(emailKey);
      await trackForgotPasswordOtpRequests(emailKey);
      await sendForgotPasswordOtp(user.firstName, emailKey, localeFromHeaders(req.headers));
    }

    return res.status(200).json({
      message: "If an account exists, an OTP has been sent to the email.",
    });
  } catch (error) {
    return next(error);
  }
};

// 🆕 RESEND PASSWORD RESET OTP
// Permet de renvoyer un OTP au même email pendant le flow forgot.
// Réutilise rate limiting + exponential backoff existants.
export const resendPasswordResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return next(new ValidationError("Email is required!"));

    const emailKey = normalizeEmail(String(email));
    const user = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });

    // Anti-énumération : même réponse que le compte existe ou non
    if (user) {
      await checkForgotPasswordOtpRestrictions(emailKey);
      await trackForgotPasswordOtpRequests(emailKey);
      await sendForgotPasswordOtp(user.firstName, emailKey, localeFromHeaders(req.headers));
    }

    return res.status(200).json({
      message: "If an account exists, a new OTP has been sent.",
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyPasswordResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };
    if (!email || !otp) {
      return next(new ValidationError("Email and OTP are required!"));
    }

    const emailKey = normalizeEmail(String(email));
    await verifyForgotPasswordOtpCode(emailKey, String(otp), localeFromHeaders(req.headers));

    const passwordResetToken = createPasswordResetToken();
    await storePasswordResetToken(passwordResetToken, emailKey);

    return res.status(200).json({
      message: "OTP verified. You can now reset your password.",
      passwordResetToken,
    });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// SESSION & PROFILE
// ───────────────────────────────────────────────────────

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));

    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        carrierPage: {
          select: {
            id: true,
            name: true,
            bio: true,
            phoneE164: true,
            onboardingStep: true,
            stripeOnboardingComplete: true,
            stripeChargesEnabled: true,
            primaryAddress: {
              select: {
                formattedAddress: true,
                placeId: true,
                lat: true,
                lng: true,
                streetLine1: true,
                city: true,
                region: true,
                postalCode: true,
                country: true,
                countryCode: true,
              },
            },
          },
        },
        avatar: { select: { url: true } },
      },
    });

    if (!fullUser) return next(new AuthError("Unauthorized"));

    const { passwordHash, ...safeUser } = fullUser;

    return res.status(200).json({
      success: true,
      user: safeUser,
      roles: req.roles ?? safeUser.roles ?? [],
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieToken = req.cookies?.["refresh_token"];

    if (cookieToken) {
      try {
        const decoded = jwt.verify(
          cookieToken,
          process.env.REFRESH_TOKEN_SECRET as string
        ) as RefreshPayload;

        if (decoded?.id && decoded?.jti) {
          await revokeRefreshJti(decoded.id, decoded.jti);
        }
      } catch {
        // Token invalide ou expiré
      }
    }

    clearAuthCookies(res);
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passwordResetToken, newPassword } = req.body as {
      passwordResetToken?: string;
      newPassword?: string;
    };

    if (!passwordResetToken || !newPassword) {
      return next(new ValidationError("passwordResetToken and newPassword are required!"));
    }

    const emailKey = await consumePasswordResetToken(String(passwordResetToken));

    const user = await prisma.user.findUnique({ where: { emailNormalized: emailKey } });
    if (!user) return next(new ValidationError("User not found!"));

    validatePasswordStrength(String(newPassword), {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.emailNormalized,
    });

    const isSamePassword = await bcrypt.compare(String(newPassword), user.passwordHash ?? "");
    if (isSamePassword) {
      return next(new ValidationError("New password cannot be the same as the old password!"));
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
      where: { emailNormalized: emailKey },
      data: { passwordHash },
    });

    const resetLocale = localeFromHeaders(req.headers);
    await sendPasswordChangedEmail(user.firstName, emailKey, resetLocale, {
      changedAt: new Date().toLocaleString(resetLocale === "en" ? "en-US" : "fr-FR"),
      ip: req.ip,
      userAgent: req.headers["user-agent"] as string,
    });

    return res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    return next(error);
  }
};

// ───────────────────────────────────────────────────────
// D44 — langue préférée (emails + interface)
// ───────────────────────────────────────────────────────

/**
 * PATCH /auth/me/locale — body { locale: "fr" | "en" | … }
 * Appelé par le header quand un utilisateur CONNECTÉ bascule la langue :
 * la préférence est enregistrée immédiatement, sans écran de profil.
 */
export const updateMyLocale = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return next(new AuthError("Unauthorized"));

    const { locale } = (req.body ?? {}) as { locale?: unknown };
    if (!isSupportedLocale(locale)) {
      return next(
        new ValidationError("Unsupported locale.", {
          type: "locale",
          code: "LOCALE_UNSUPPORTED",
          field: "locale",
        })
      );
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { preferredLocale: locale },
    });

    return res.status(200).json({ success: true, preferredLocale: locale });
  } catch (error) {
    return next(error);
  }
};
