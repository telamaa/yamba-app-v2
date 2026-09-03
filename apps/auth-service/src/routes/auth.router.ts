import express, { Router } from "express";
import {
  cancelRegistration,
  getMe,
  loginUser,
  logoutUser,
  refreshAuthTokens,
  registerUser,
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  resendRegistrationOtp,
  resetPassword,
  verifyPasswordResetOtp,
  verifyRegistrationOtp,
  updateMyLocale,
} from "../controller/auth.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router: Router = express.Router();

// ─── Inscription ───────────────────────────────────────
router.post("/auth/register", registerUser);
router.post("/auth/register/verify", verifyRegistrationOtp);
router.post("/auth/register/resend", resendRegistrationOtp);
router.post("/auth/register/cancel", cancelRegistration); // 🆕

// ─── Authentification ──────────────────────────────────
router.post("/auth/login", loginUser);
router.post("/auth/refresh", refreshAuthTokens);
router.post("/auth/logout", logoutUser);
router.get("/auth/me", isAuthenticated, getMe);
router.patch("/auth/me/locale", isAuthenticated, updateMyLocale); // D44

// ─── Mot de passe oublié ───────────────────────────────
router.post("/auth/password/forgot", requestPasswordResetOtp);
router.post("/auth/password/verify", verifyPasswordResetOtp);
router.post("/auth/password/resend", resendPasswordResetOtp); // 🆕
router.post("/auth/password/reset", resetPassword);

export default router;
