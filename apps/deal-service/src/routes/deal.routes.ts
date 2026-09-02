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
import { makeDealTransportController } from "../controllers/deal-transport.controller";
import { makeDealTransportService } from "../services/deal-transport.service";
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
const dealTransport = makeDealTransportController(makeDealTransportService(paymentProvider));

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

// B3-PR1 — transport (D42/D43, A38–A41) : pickup = checklist 5/5 + photos
// + code généré (bcrypt + AES) · refuse = remboursement intégral + CAP-02 ·
// events = jalons optionnels (séquence stricte) · code/regenerate =
// Expéditeur, ≤ 5 · deliver = bcrypt, 3 essais / verrou 15 min
router.post("/deals/:id/pickup", isAuthenticated, dealTransport.confirmPickup);
router.post("/deals/:id/pickup/refuse", isAuthenticated, dealTransport.refusePickup);
router.post("/deals/:id/events", isAuthenticated, dealTransport.confirmTrackingStep);
router.post("/deals/:id/code/regenerate", isAuthenticated, dealTransport.regenerateCode);
router.post("/deals/:id/deliver", isAuthenticated, dealTransport.deliver);

// Deals d'un de MES trips (vue Carrier) — ?tripId=<ObjectId>[&status=]
router.get("/deals", isAuthenticated, getTripDeals);

// Un deal, vue par rôle (Shipper OU Carrier — 403 sinon)
router.get("/deals/:id", isAuthenticated, getDeal);

// Mes envois (vue Shipper) — [?status=]
router.get("/me/bookings", isAuthenticated, getMyBookings);

export default router;
