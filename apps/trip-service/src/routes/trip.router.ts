import { Router } from "express";
import {
  createTrip,
  updateTrip,
  getTrip,
  getMyTrips,
  addTripDocuments,
  removeTripDocument,
  cancelTrip,
  deleteTrip,                // ⭐ Lot 2 — dispatch ?hard=true → soft delete, sinon alias cancel
  archiveTrip,               // ⭐ Lot 2 — NOUVEAU
  restoreTrip,
  publishTrip,
  pauseTrip,
  resumeTrip,
  unpublishTrip,
  getPublicTrip,             // ⭐ (PR 1.a)
} from "../controllers/trip.controller";
// ⭐ Controllers de la search publique
import {
  searchTrips,
  searchTripsFacets,
} from "../controllers/trip-search.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import requireActiveAccount from "@packages/middleware/requireActiveAccount";
import isOptionallyAuthenticated from "@packages/middleware/isOptionallyAuthenticated";
import {
  addTripFavorite,
  listMyFavoriteTrips,
  removeTripFavorite,
} from "../controllers/trip-favorite.controller";

const router = Router();

// ─── ⭐ PUBLIC SEARCH (PAS d'authent) ────────
// IMPORTANT : ces routes DOIVENT être déclarées AVANT /:id, sinon Express
// match "search" comme un id et appelle getTrip avec un faux id.
// D46 : authent OPTIONNELLE — un utilisateur connecté voit ses favoris (isFavorite),
// un visiteur reçoit la même réponse avec isFavorite = false.
router.get("/search", isOptionallyAuthenticated, searchTrips);
router.get("/search/facets", searchTripsFacets);

// ─── ⭐ FAVORIS (D46) — AVANT /:id ────────────
router.get("/favorites", isAuthenticated, listMyFavoriteTrips);

// ─── ⭐ PUBLIC TRIP DETAIL (PAS d'authent) — PR 1.a ───
// Idem : doit être déclaré avant /:id pour ne pas être matché comme route privée.
router.get("/:id/public", isOptionallyAuthenticated, getPublicTrip);
router.post("/:id/favorite", isAuthenticated, addTripFavorite);      // D46 — idempotent
router.delete("/:id/favorite", isAuthenticated, removeTripFavorite); // D46 — idempotent

// ─── Trip CRUD ───────────────────────────────
router.post("/", isAuthenticated, requireActiveAccount, createTrip); // C-PR3 (D56) : compte restreint = pas de publication                             // Créer un trip
router.get("/my", isAuthenticated, getMyTrips);                            // Mes trips (avec filtre ?status=)
router.get("/:id", isAuthenticated, getTrip);                              // Détail d'un trip (owner only)
router.put("/:id", isAuthenticated, updateTrip);                           // Modifier un trip

// ⭐ Lot 2 — DELETE conservé en alias backward-compat :
//   ?hard=true → soft delete d'un brouillon (isDeleted + deletedAt)
//   sinon      → alias de cancel (même philosophie que resolveSectionKey)
router.delete("/:id", isAuthenticated, deleteTrip);

// ─── Lifecycle ───────────────────────────────
router.post("/:id/publish", isAuthenticated, requireActiveAccount, publishTrip);                 // Publier un brouillon
router.post("/:id/pause", isAuthenticated, pauseTrip);                     // Mettre en pause
router.post("/:id/resume", isAuthenticated, resumeTrip);                   // Reprendre après pause
router.post("/:id/restore", isAuthenticated, restoreTrip);                 // Restaurer un trip annulé
router.post("/:id/unpublish", isAuthenticated, unpublishTrip);             // Repasser en brouillon
router.post("/:id/cancel", isAuthenticated, cancelTrip);                   // ⭐ Lot 2 — Annuler (endpoint explicite)
router.post("/:id/archive", isAuthenticated, archiveTrip);                 // ⭐ Lot 2 — Archiver (one-way)

// ─── Documents ───────────────────────────────
router.post("/:id/documents", isAuthenticated, addTripDocuments);          // Ajouter des documents
router.delete("/:id/documents/:documentId", isAuthenticated, removeTripDocument); // Supprimer un document

export default router;
