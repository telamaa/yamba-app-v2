import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import isAdminAuthenticated from "@packages/middleware/isAdminAuthenticated";
import requireActiveAccount from "@packages/middleware/requireActiveAccount";
import { requireAdminPermission } from "@packages/middleware/requireAdminRole";
import {
  getDeal,
  getMyBookings,
  getMyDeals,
  getTripDeals,
} from "../controllers/deal.controller";
import { makeDealRequestController } from "../controllers/deal-request.controller";
import { makeDealRequestService } from "../services/deal-request.service";
import { makeDealLifecycleController } from "../controllers/deal-lifecycle.controller";
import { makeDealLifecycleService } from "../services/deal-lifecycle.service";
import { makeDealTransportController } from "../controllers/deal-transport.controller";
import { makeDealTransportService } from "../services/deal-transport.service";
import { makeDealSettlementController } from "../controllers/deal-settlement.controller";
import { makeDealSettlementService } from "../services/deal-settlement.service";
import { getMyWallet } from "../controllers/wallet.controller";
import { makeDealRatingController } from "../controllers/deal-rating.controller";
import { makeDealRatingService } from "../services/deal-rating.service";
import { createPaymentProviderFromEnv } from "@packages/payments";
import { makeAdminDisputeController } from "../controllers/admin-dispute.controller";
import { makeAdminDisputeService } from "../services/admin-dispute.service";
import { makeDealMediationController } from "../controllers/deal-mediation.controller";
import { makeAdminFinanceController } from "../controllers/admin-finance.controller";
import { makeAdminFinanceService } from "../services/admin-finance.service";
import { makeDealMediationService } from "../services/deal-mediation.service";

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
// A80 — l'exécuteur de versement est construit AVANT le cycle de vie : la
// compensation d'annulation tardive part par le même chemin (D49).
export const dealSettlementService = makeDealSettlementService(paymentProvider);
export const dealLifecycleService = makeDealLifecycleService(paymentProvider, undefined, dealSettlementService);
const dealRequest = makeDealRequestController(makeDealRequestService(paymentProvider));
const dealLifecycle = makeDealLifecycleController(dealLifecycleService);
const dealTransport = makeDealTransportController(makeDealTransportService(paymentProvider));
const dealSettlement = makeDealSettlementController(dealSettlementService);
export const dealRatingService = makeDealRatingService();
const dealRating = makeDealRatingController(dealRatingService);

// Autorisation du montant (empreinte) — étape 1 de la demande (D37)
router.post("/deals/payment-intents", isAuthenticated, requireActiveAccount, dealRequest.createPaymentIntent); // C-PR3 (D56)

// Naissance du deal (PENDING) — étape 2 : snapshot D17 + kg + outbox en transaction
router.post("/deals", isAuthenticated, requireActiveAccount, dealRequest.createBooking);

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

// ── B4-PR1 : règlement (D49/D51) ─────────────────────────────
router.post("/deals/:id/confirm", isAuthenticated, dealSettlement.confirm);
router.post("/deals/:id/dispute", isAuthenticated, dealSettlement.dispute);

// ── B5 : notation mutuelle double-aveugle (D53) ──────────────
// C-PR2 (D55) — la version du Voyageur, une fois, pendant que le dossier est ouvert.
const dealMediation = makeDealMediationController(makeDealMediationService(paymentProvider, dealSettlementService));
router.post("/deals/:id/dispute/statement", isAuthenticated, dealMediation.respond);
router.get("/deals/:id/rating", isAuthenticated, dealRating.getContext);
router.post("/deals/:id/rating", isAuthenticated, dealRating.submit);

// Deals d'un de MES trips (vue Carrier) — ?tripId=<ObjectId>[&status=]
router.get("/deals", isAuthenticated, getTripDeals);

// Un deal, vue par rôle (Shipper OU Carrier — 403 sinon)
router.get("/deals/:id", isAuthenticated, getDeal);

// Mes envois (vue Shipper) — [?status=]
router.get("/me/bookings", isAuthenticated, getMyBookings);

// Mes deals reçus (vue Carrier, tous trajets — A44) — [?status=]
router.get("/me/deals", isAuthenticated, getMyDeals);

// ── Finances (A83) : totaux calculés serveur, les deux rôles ──
router.get("/me/wallet", isAuthenticated, getMyWallet);

// ── Chantier C (D54) : file « à arbitrer » + dossier, ADMIN + 2FA seulement ──
const adminDisputes = makeAdminDisputeController(makeAdminDisputeService());
router.get("/admin/disputes", isAdminAuthenticated, requireAdminPermission("disputes.read"), adminDisputes.listQueue);
router.get("/admin/disputes/:id", isAdminAuthenticated, requireAdminPermission("disputes.read"), adminDisputes.getFile);
router.post("/admin/disputes/:id/resolve", isAdminAuthenticated, requireAdminPermission("disputes.decide"), dealMediation.resolveDispute);
router.post("/admin/disputes/:id/retention", isAdminAuthenticated, requireAdminPermission("disputes.decide"), dealMediation.resolveRetention);

// ── C-PR5a (D58) : finances — files d'exception, fiche argent, rapprochement, rejeu, renversements ──
const adminFinance = makeAdminFinanceController(makeAdminFinanceService(paymentProvider, dealSettlementService));
router.get("/admin/finances/queue", isAdminAuthenticated, requireAdminPermission("finances.read"), adminFinance.listQueue);
router.get("/admin/deals/:id/money", isAdminAuthenticated, requireAdminPermission("finances.read"), adminFinance.getMoneyFile);
router.post("/admin/deals/:id/money/reconcile", isAdminAuthenticated, requireAdminPermission("finances.read"), adminFinance.reconcile);
router.post("/admin/deals/:id/payout/retry", isAdminAuthenticated, requireAdminPermission("payouts.retry"), adminFinance.retryPayout);
router.post("/admin/deals/:id/payout/reversal", isAdminAuthenticated, requireAdminPermission("payouts.resolve"), adminFinance.resolveReversal);
// C-PR5b (D58 5A, 3A-c) : rapport mensuel, export CSV journalisé, remboursement manuel (proposé / appliqué par SUPER_ADMIN)
router.get("/admin/finances/report", isAdminAuthenticated, requireAdminPermission("finances.read"), adminFinance.getReport);
router.get("/admin/finances/export", isAdminAuthenticated, requireAdminPermission("finances.export"), adminFinance.exportCsv);
router.post("/admin/deals/:id/refund/propose", isAdminAuthenticated, requireAdminPermission("refunds.manual.propose"), adminFinance.proposeRefund);
router.post("/admin/deals/:id/refund", isAdminAuthenticated, requireAdminPermission("refunds.manual.apply"), adminFinance.applyRefund);

export default router;
