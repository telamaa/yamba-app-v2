import express, { Router } from "express";
import {
  saveCarrierProfile,
  createStripeConnectLink,
  checkStripeStatus,
  completeCarrierOnboarding,
} from "../controller/carrier.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router: Router = express.Router();

// Onboarding étape 1 : profil
router.post("/carrier/onboarding/profile", isAuthenticated, saveCarrierProfile);

// Onboarding étape 2 : Stripe Connect
router.post("/carrier/onboarding/stripe", isAuthenticated, createStripeConnectLink);
router.get("/carrier/onboarding/stripe/status", isAuthenticated, checkStripeStatus);

// Finaliser (skip Stripe)
router.post("/carrier/onboarding/complete", isAuthenticated, completeCarrierOnboarding);

export default router;
