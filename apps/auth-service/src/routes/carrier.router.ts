import express, { Router } from "express";
import {
  saveCarrierProfile,
  createStripeConnectLink,
  checkStripeStatus,
  completeCarrierOnboarding,
  createStripeDashboardLink,
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

// Finances (A84) : tableau de bord Stripe Express (virements, RIB) — lien à usage unique
router.post("/carrier/stripe/dashboard-link", isAuthenticated, createStripeDashboardLink);

export default router;
