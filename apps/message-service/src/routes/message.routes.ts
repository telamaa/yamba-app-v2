/**
 * message.routes.ts — surface HTTP du chat (chantier F, D61)
 * ==========================================================
 * Monté sur /messages ; le gateway proxifie /api/messages/* (frontière stable : le jour où
 * ce service grossit, seul le proxy change, jamais les clients).
 *
 *  GET    /messages/conversations                       mes fils, non-lus, prochain rendez-vous
 *  GET    /messages/conversations/by-deal/:bookingId    le fil d'un deal (créé à la demande)
 *  GET    /messages/conversations/:id                   le fil paginé
 *  POST   /messages/conversations/:id/messages          écrire (gardes code et coordonnées)
 *  POST   /messages/conversations/:id/read              marquer lu
 *  POST   /messages/conversations/:id/meetups           proposer un rendez-vous
 *  POST   /messages/conversations/:id/meetups/:mid/accept
 *  POST   /messages/conversations/:id/phone             révéler le numéro (2 h avant)
 *  GET    /messages/quick-replies                       réponses rapides dans la langue du lecteur
 */
import { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { makeMessageController } from "../controllers/message.controller";
import { makeConversationService } from "../services/conversation.service";

const router = Router();
export const conversationService = makeConversationService();
const controller = makeMessageController(conversationService);

router.get("/quick-replies", isAuthenticated, controller.quickReplies);
router.get("/conversations", isAuthenticated, controller.list);
// Avant /conversations/:id — sinon « by-deal » serait pris pour un identifiant.
router.get("/conversations/by-deal/:bookingId", isAuthenticated, controller.byDeal);
router.get("/conversations/:id", isAuthenticated, controller.thread);
router.post("/conversations/:id/messages", isAuthenticated, controller.postMessage);
router.post("/conversations/:id/read", isAuthenticated, controller.markRead);
router.post("/conversations/:id/meetups", isAuthenticated, controller.proposeMeetup);
router.post("/conversations/:id/meetups/:meetupId/accept", isAuthenticated, controller.acceptMeetup);
router.post("/conversations/:id/phone", isAuthenticated, controller.revealPhone);

export default router;
