import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import {
  getDeal,
  getMyBookings,
  getTripDeals,
} from "../controllers/deal.controller";
import { makeDealRequestController } from "../controllers/deal-request.controller";
import { makeDealRequestService } from "../services/deal-request.service";
import { makeDealLifecycleController } from "../controllers/deal-lifecycle.controller";
import { makeDealLifecycleService } from "../services/deal-lifecycle.service";
import { createPaymentProviderFromEnv } from "@packages/payments";

/**
 * deal.routes.ts — routes de lecture (PR3)
 * ========================================
 * Emplacement : apps/deal-service/src/routes/deal.routes.ts
 *
 * Les chemins sont SANS préfixe /api : le gateway proxifie
 * /api/deals → :6003/deals et /api/me/bookings → :6003/me/bookings
 * (proxies déclarés avant le catch-all auth — PR1).
 *
 * Toutes les routes exigent l'authentification (isAuthenticated,
 * cookie access_token ou bearer — @packages/middleware).
 * Ordre : /deals (query tripId) AVANT /deals/:id — pas d'ambiguïté
 * Express, mais l'ordre documente l'intention.
 */

const router = Router();

// B2 — écriture : UN PaymentProvider (D11) choisi par l'environnement
// (Stripe si STRIPE_SECRET_KEY, sinon Fake hors production), partagé par
// la demande (D37) et les transitions (D39). Le service de cycle de vie
// est exporté : le cron d'expiration et le webhook Stripe (main.ts) le
// réutilisent — une seule instance, une seule vérité.
const paymentProvider = createPaymentProviderFromEnv();
export const dealLifecycleService = makeDealLifecycleService(paymentProvider);
const dealRequest = makeDealRequestController(makeDealRequestService(paymentProvider));
const dealLifecycle = makeDealLifecycleController(dealLifecycleService);

// Autorisation du montant (empreinte) — étape 1 de la demande (D37)
router.post("/deals/payment-intents", isAuthenticated, dealRequest.createPaymentIntent);

// Naissance du deal (PENDING) — étape 2 : snapshot D17 + kg + outbox en transaction
router.post("/deals", isAuthenticated, dealRequest.createBooking);

// B2-PR2 — transitions (booking-state-machine, jamais un controller) :
// accept = gate D31 + capture D39 · decline = libération + CAP-02 ·
// cancel = ANN-01 (100 % jusqu'à J-2, retenue 50 % ensuite)
router.post("/deals/:id/accept", isAuthenticated, dealLifecycle.accept);
router.post("/deals/:id/decline", isAuthenticated, dealLifecycle.decline);
router.post("/deals/:id/cancel", isAuthenticated, dealLifecycle.cancel);

// Deals d'un de MES trips (vue Carrier) — ?tripId=<ObjectId>[&status=]
router.get("/deals", isAuthenticated, getTripDeals);

// Un deal, vue par rôle (Shipper OU Carrier — 403 sinon)
router.get("/deals/:id", isAuthenticated, getDeal);

// Mes envois (vue Shipper) — [?status=]
router.get("/me/bookings", isAuthenticated, getMyBookings);

export default router;
