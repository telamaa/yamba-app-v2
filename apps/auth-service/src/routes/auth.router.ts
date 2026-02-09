import express, { Router } from "express";
import {
  loginUser,
  refreshAuthTokens,
  registerUser, requestPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
  verifyRegistrationOtp,

} from "../controller/auth.controller";

const router: Router = express.Router();

router.post("/auth/register", registerUser);  //(envoie OTP + retourne verificationToken)
router.post("/auth/register/verify", verifyRegistrationOtp);
router.post("/auth/login", loginUser);
router.post("/auth/refresh", refreshAuthTokens);
// router.get("/logged-in-user", isAuthenticated, getUser);
router.post("/auth/password/forgot", requestPasswordResetOtp);
router.post("/auth/password/verify", verifyPasswordResetOtp);
router.post("/auth/password/reset", resetPassword);

export default router;
