import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import {
  getDeal,
  getMyBookings,
  getTripDeals,
} from "../controllers/deal.controller";

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

// Deals d'un de MES trips (vue Carrier) — ?tripId=<ObjectId>[&status=]
router.get("/deals", isAuthenticated, getTripDeals);

// Un deal, vue par rôle (Shipper OU Carrier — 403 sinon)
router.get("/deals/:id", isAuthenticated, getDeal);

// Mes envois (vue Shipper) — [?status=]
router.get("/me/bookings", isAuthenticated, getMyBookings);

export default router;
