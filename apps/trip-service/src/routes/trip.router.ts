import { Router } from "express";
import {
  createTrip,
  updateTrip,
  getTrip,
  getMyTrips,
  addTripDocuments,
  removeTripDocument,
  cancelTrip,
  restoreTrip,
  publishTrip,
  pauseTrip,
  resumeTrip,
  unpublishTrip,
} from "../controllers/trip.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router = Router();

// ─── Trip CRUD ───────────────────────────────
router.post("/", isAuthenticated, createTrip);                             // Créer un trip
router.get("/my", isAuthenticated, getMyTrips);                            // Mes trips (avec filtre ?status=)
router.get("/:id", isAuthenticated, getTrip);                              // Détail d'un trip
router.put("/:id", isAuthenticated, updateTrip);                           // Modifier un trip
router.delete("/:id", isAuthenticated, cancelTrip);                        // Annuler (soft delete)

// ─── Lifecycle ───────────────────────────────
router.post("/:id/publish", isAuthenticated, publishTrip);                 // Publier un brouillon
router.post("/:id/pause", isAuthenticated, pauseTrip);                     // Mettre en pause
router.post("/:id/resume", isAuthenticated, resumeTrip);                   // Reprendre après pause
router.post("/:id/restore", isAuthenticated, restoreTrip);
router.post("/:id/unpublish", isAuthenticated, unpublishTrip);  // Repasser en brouillon// Restaurer un trip annulé

// ─── Documents ───────────────────────────────
router.post("/:id/documents", isAuthenticated, addTripDocuments);          // Ajouter des documents
router.delete("/:id/documents/:documentId", isAuthenticated, removeTripDocument); // Supprimer un document

export default router;
