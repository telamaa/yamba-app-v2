import express, { Router } from "express";
import { eraseMyAccount, exportMyData, getMyErasureBlockers, requestSudoCode, updateMyPreferences } from "../controller/privacy.controller"; // C-PR8b (D63)
import { changeMyPassword, confirmEmailChange, getSudoStatus, listMySessions, requestEmailChange, revokeMyOtherSessions, revokeMySession, verifySudo } from "../controller/account.controller"; // D65
import { deleteMyAvatar, getMyProfile, setMyAvatar, updateMyProfile } from "../controller/profile.controller"; // D67
import { makeReportController } from "../controller/report.controller"; // D68
import {
  cancelRegistration,
  getMe,
  googleSignIn,
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
router.post("/auth/google", googleSignIn); // D47
router.post("/auth/refresh", refreshAuthTokens);
router.post("/auth/logout", logoutUser);
router.get("/auth/me", isAuthenticated, getMe);
router.patch("/auth/me/locale", isAuthenticated, updateMyLocale); // D44
// C-PR8b (D63) — droits sur les données : sudo par code email, export, effacement, préférences
router.post("/auth/me/sudo/request", isAuthenticated, requestSudoCode);
router.post("/auth/me/data-export", isAuthenticated, exportMyData);
router.get("/auth/me/erasure/blockers", isAuthenticated, getMyErasureBlockers);
router.post("/auth/me/erasure", isAuthenticated, eraseMyAccount);
router.patch("/auth/me/preferences", isAuthenticated, updateMyPreferences);
// D65 — sudo à fenêtre, sessions, identifiants
router.post("/auth/me/sudo/verify", isAuthenticated, verifySudo);
router.get("/auth/me/sudo", isAuthenticated, getSudoStatus);
router.get("/auth/me/sessions", isAuthenticated, listMySessions);
router.delete("/auth/me/sessions", isAuthenticated, revokeMyOtherSessions);
router.delete("/auth/me/sessions/:jti", isAuthenticated, revokeMySession);
router.post("/auth/me/password", isAuthenticated, changeMyPassword);
router.post("/auth/me/email/request", isAuthenticated, requestEmailChange);
router.post("/auth/me/email/confirm", isAuthenticated, confirmEmailChange);
// D67 — profil éditable
router.get("/auth/me/profile", isAuthenticated, getMyProfile);
router.patch("/auth/me/profile", isAuthenticated, updateMyProfile);
router.post("/auth/me/avatar", isAuthenticated, setMyAvatar);
router.delete("/auth/me/avatar", isAuthenticated, deleteMyAvatar);
// D68 — signaler un trajet ou un membre (un seul endpoint, SIG-02)
const reports = makeReportController();
router.post("/reports", isAuthenticated, reports.createReport);

// ─── Mot de passe oublié ───────────────────────────────
router.post("/auth/password/forgot", requestPasswordResetOtp);
router.post("/auth/password/verify", verifyPasswordResetOtp);
router.post("/auth/password/resend", resendPasswordResetOtp); // 🆕
router.post("/auth/password/reset", resetPassword);

export default router;
