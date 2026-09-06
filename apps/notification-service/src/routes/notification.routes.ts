/**
 * notification.routes.ts — routes de la boîte (PR4bis)
 * =====================================================
 * Chemins SANS préfixe /api : le gateway proxifie
 * /api/me/notifications → :6004/me/notifications (proxy déclaré
 * AVANT le catch-all auth — 7c).
 */
import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { makeEmailWebhookController } from "../controllers/email-webhook.controller";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller";

const router = Router();

// D35 3A — webhook du fournisseur d'email (signature Svix, corps brut) : aucune session, jamais derrière isAuthenticated
router.post("/webhooks/email/resend", makeEmailWebhookController({ secret: () => process.env.RESEND_WEBHOOK_SECRET, log: console }));

router.get("/me/notifications", isAuthenticated, getMyNotifications);
// Déclaré AVANT /:id/read — "read-all" n'est pas un ObjectId (A91)
router.patch("/me/notifications/read-all", isAuthenticated, markAllNotificationsRead);
router.patch("/me/notifications/:id/read", isAuthenticated, markNotificationRead);

export default router;
