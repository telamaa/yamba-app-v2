import express, { Router } from "express";
import {
  getMe,
  loginUser, logoutUser,
  refreshAuthTokens,
  registerUser, requestPasswordResetOtp, resendRegistrationOtp,
  resetPassword,
  verifyPasswordResetOtp,
  verifyRegistrationOtp,

} from "../controller/auth.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router: Router = express.Router();

// inscription initiale, envoi OTP + retour verificationToken
router.post("/auth/register", registerUser);  //(envoie OTP + retourne verificationToken)

// vérification OTP
router.post("/auth/register/verify", verifyRegistrationOtp);
router.post("/auth/register/resend", resendRegistrationOtp);

router.post("/auth/login", loginUser);
router.post("/auth/refresh", refreshAuthTokens);
// router.get("/logged-in-user", isAuthenticated, getUser);

router.get("/auth/me", isAuthenticated, getMe);


// OTP de réinitialisation mot de passe
router.post("/auth/password/forgot", requestPasswordResetOtp);
router.post("/auth/password/verify", verifyPasswordResetOtp);
router.post("/auth/password/reset", resetPassword);


router.post("/auth/logout", logoutUser);

export default router;
