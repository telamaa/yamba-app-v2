/**
 * admin.router.ts — routes admin du message-service (F-PR3, D61 7A)
 * ===================================================================
 * Monté sur /admin/conversations ; le gateway proxifie /api/admin/conversations/*.
 * Session ADMIN seulement (isAdminAuthenticated, jamais le cookie utilisateur), permission
 * par route (matrice ADMIN_PERMISSIONS) :
 *
 *  GET   /admin/conversations/reports              file des messages signalés   (reports.review)
 *  PATCH /admin/conversations/reports/:id          traiter un signalement       (reports.review)
 *  GET   /admin/conversations/by-deal/:bookingId   lire un fil, journalisé      (conversations.read)
 */
import { Router } from "express";
import isAdminAuthenticated from "@packages/middleware/isAdminAuthenticated";
import { requireAdminPermission } from "@packages/middleware/requireAdminRole";
import { makeAdminConversationsController } from "../controllers/admin-conversations.controller";
import { makeAdminConversationService } from "../services/admin-conversation.service";

const router = Router();
const controller = makeAdminConversationsController(makeAdminConversationService());

router.get("/reports", isAdminAuthenticated, requireAdminPermission("reports.review"), controller.listReports);
router.patch("/reports/:id", isAdminAuthenticated, requireAdminPermission("reports.review"), controller.reviewReport);
router.get("/by-deal/:bookingId", isAdminAuthenticated, requireAdminPermission("conversations.read"), controller.viewByDeal);

export default router;
