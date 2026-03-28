import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { AuthError, ValidationError } from "@packages/error-handler";

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
  hasRefreshJti,
  normalizeEmail,
  revokeRefreshJti,
  sendAccountCreatedEmail,
  sendForgotPasswordOtp,
  sendOtp,
  sendPasswordChangedEmail,
  storePasswordResetToken,
  storePendingRegistration,
  storeRefreshJti,
  storeVerificationToken,
  trackForgotPasswordOtpRequests,
  trackOtpRequests,
  validatePasswordStrength,
  validateRegistrationData,
  verifyForgotPasswordOtpCode,
  verifyOtp,
} from "../utils/auth.helper";
import { clearAuthCookies, setCookie } from "../utils/cookies/setCookie";
import jwt from "jsonwebtoken";
import {AuthenticatedRequest} from "@packages/middleware/isAuthenticated";

// Register a new user (send OTP, do not create user yet)
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateRegistrationData(req.body);
    const emailKey = data.emailNormalized;

    const existingUser = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });
    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }

    await checkOtpRestrictions(emailKey);
    await trackOtpRequests(emailKey);

    const passwordHash = await bcrypt.hash(data.password, 10);

    await storePendingRegistration(emailKey, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      emailNormalized: data.emailNormalized,
      gender: data.gender,
      passwordHash,
    });

    await sendOtp(data.firstName, emailKey, "register-activation-mail");

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

// Resend registration OTP using the existing verificationToken
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
      return next(new ValidationError("User already exists with this email!"));
    }

    await checkOtpRestrictions(emailKey);
    await trackOtpRequests(emailKey);

    await sendOtp(pending.firstName, emailKey, "register-activation-mail");

    return res.status(200).json({
      message: "OTP sent again.",
      verificationToken: token,
    });
  } catch (error) {
    return next(error);
  }
};

// Verify user with OTP + verificationToken, then create user
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

    await verifyOtp(emailKey, String(otp));

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
      return next(new ValidationError("User already exists with this email!"));
    }

    await prisma.user.create({
      data: {
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        emailNormalized: pending.emailNormalized,
        gender: pending.gender,
        passwordHash: pending.passwordHash,
      },
    });

    sendAccountCreatedEmail(pending.firstName, pending.emailNormalized, {
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

// Login user
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      password,
      rememberMe,
    } = req.body as {
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

    const jti = createRefreshJti();
    await storeRefreshJti(user.id, jti, shouldRemember);

    const refreshToken = jwt.sign(
      { id: user.id, jti, rememberMe: shouldRemember },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: shouldRemember ? "30d" : "7d" }
    );

    setCookie(res, "access_token", accessToken);
    setCookie(res, "refresh_token", refreshToken, {
      rememberMe: shouldRemember,
    });

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

// Refresh token User
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
      decoded = jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET as string
      ) as RefreshPayload;
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

    const jtiValid = await hasRefreshJti(user.id, decoded.jti);
    if (!jtiValid) {
      clearAuthCookies(res);
      return next(new AuthError("Unauthorized! Refresh token reuse detected."));
    }

    // Révoquer l'ancien jti de CETTE session uniquement (rotation)
    await revokeRefreshJti(user.id, decoded.jti);

    const shouldRemember = Boolean(decoded.rememberMe);

    const newAccessToken = jwt.sign(
      { id: user.id, roles: user.roles },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" }
    );

    const newJti = createRefreshJti();
    await storeRefreshJti(user.id, newJti, shouldRemember);

    const newRefreshToken = jwt.sign(
      { id: user.id, jti: newJti, rememberMe: shouldRemember },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: shouldRemember ? "30d" : "7d" }
    );

    setCookie(res, "access_token", newAccessToken);
    setCookie(res, "refresh_token", newRefreshToken, {
      rememberMe: shouldRemember,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

// Request password reset OTP
export const requestPasswordResetOtp = async (
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

    if (user) {
      await checkForgotPasswordOtpRestrictions(emailKey);
      await trackForgotPasswordOtpRequests(emailKey);
      await sendForgotPasswordOtp(user.firstName, emailKey, "forgot-password-mail");
    }

    return res.status(200).json({
      message: "If an account exists, an OTP has been sent to the email.",
    });
  } catch (error) {
    return next(error);
  }
};

// Verify forgot password OTP
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

    await verifyForgotPasswordOtpCode(emailKey, String(otp));

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


// GET /auth/me
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AuthError("Unauthorized"));
    }

    const { passwordHash, ...safeUser } = req.user;

    return res.status(200).json({
      success: true,
      user: safeUser,
      roles: req.roles ?? safeUser.roles ?? [],
    });
  } catch (error) {
    return next(error);
  }
};

// Reset user password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passwordResetToken, newPassword } = req.body as {
      passwordResetToken?: string;
      newPassword?: string;
    };

    if (!passwordResetToken || !newPassword) {
      return next(
        new ValidationError("passwordResetToken and newPassword are required!")
      );
    }

    const emailKey = await consumePasswordResetToken(String(passwordResetToken));

    const user = await prisma.user.findUnique({
      where: { emailNormalized: emailKey },
    });
    if (!user) return next(new ValidationError("User not found!"));

    validatePasswordStrength(String(newPassword), {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.emailNormalized,
    });

    const isSamePassword = await bcrypt.compare(
      String(newPassword),
      user.passwordHash ?? ""
    );
    if (isSamePassword) {
      return next(
        new ValidationError("New password cannot be the same as the old password!")
      );
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
      where: { emailNormalized: emailKey },
      data: { passwordHash },
    });

    await sendPasswordChangedEmail(user.firstName, emailKey, {
      changedAt: new Date().toLocaleString("fr-FR"),
      ip: req.ip,
      userAgent: req.headers["user-agent"] as string,
    });

    return res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    return next(error);
  }
};

// Logout user
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
        // Token invalide ou expiré — on nettoie quand même les cookies
      }
    }

    clearAuthCookies(res);

    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    return next(error);
  }
};
