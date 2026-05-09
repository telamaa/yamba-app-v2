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
  getPublicTrip,             // ⭐ NEW (PR 1.a)
} from "../controllers/trip.controller";
// ⭐ NEW : controllers de la search publique
import {
  searchTrips,
  searchTripsFacets,
} from "../controllers/trip-search.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router = Router();

// ─── ⭐ PUBLIC SEARCH (PAS d'authent) ────────
// IMPORTANT : ces routes DOIVENT être déclarées AVANT /:id, sinon Express
// match "search" comme un id et appelle getTrip avec un faux id.
router.get("/search", searchTrips);
router.get("/search/facets", searchTripsFacets);

// ─── ⭐ PUBLIC TRIP DETAIL (PAS d'authent) — PR 1.a ───
// Idem : doit être déclaré avant /:id pour ne pas être matché comme route privée.
router.get("/:id/public", getPublicTrip);

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
router.post("/:id/restore", isAuthenticated, restoreTrip);                 // Restaurer un trip annulé
router.post("/:id/unpublish", isAuthenticated, unpublishTrip);             // Repasser en brouillon

// ─── Documents ───────────────────────────────
router.post("/:id/documents", isAuthenticated, addTripDocuments);          // Ajouter des documents
router.delete("/:id/documents/:documentId", isAuthenticated, removeTripDocument); // Supprimer un document

export default router;
