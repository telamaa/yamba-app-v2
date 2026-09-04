/**
 * admin.router.ts — routes ADMIN du trip-service (C-PR4, D57)
 * Monté sur /admin ; le gateway proxifie /api/admin/trips et /api/admin/tickets.
 */
import { Router } from "express";
import isAdminAuthenticated from "@packages/middleware/isAdminAuthenticated";
import { requireAdminPermission } from "@packages/middleware/requireAdminRole";
import { getTripFile, hideTrip, listTickets, listTrips, proposeHide, reviewTicket, unhideTrip, viewTicket } from "../controllers/admin-trips.controller";

const router = Router();

router.get("/trips", isAdminAuthenticated, requireAdminPermission("trips.read"), listTrips);
router.get("/trips/:id", isAdminAuthenticated, requireAdminPermission("trips.read"), getTripFile);
router.post("/trips/:id/hide/propose", isAdminAuthenticated, requireAdminPermission("trips.hide.propose"), proposeHide);
router.post("/trips/:id/hide", isAdminAuthenticated, requireAdminPermission("trips.hide.apply"), hideTrip);
router.delete("/trips/:id/hide", isAdminAuthenticated, requireAdminPermission("trips.hide.apply"), unhideTrip);

router.get("/tickets", isAdminAuthenticated, requireAdminPermission("tickets.review"), listTickets);
router.get("/tickets/:documentId", isAdminAuthenticated, requireAdminPermission("tickets.review"), viewTicket);
router.post("/tickets/:documentId/review", isAdminAuthenticated, requireAdminPermission("tickets.review"), reviewTicket);

export default router;
