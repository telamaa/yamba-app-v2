/**
 * notification.routes.ts — routes de la boîte (PR4bis)
 * =====================================================
 * Chemins SANS préfixe /api : le gateway proxifie
 * /api/me/notifications → :6004/me/notifications (proxy déclaré
 * AVANT le catch-all auth — 7c).
 */
import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import {
  getMyNotifications,
  markNotificationRead,
} from "../controllers/notification.controller";

const router = Router();

router.get("/me/notifications", isAuthenticated, getMyNotifications);
router.patch("/me/notifications/:id/read", isAuthenticated, markNotificationRead);

export default router;
