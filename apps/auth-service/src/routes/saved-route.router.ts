import express, { Router } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import {
  createSavedRoute,
  listSavedRoutes,
  updateSavedRoute,
  deleteSavedRoute,
  extendSavedRoute,
} from "../controller/saved-route.controller";

const router: Router = express.Router();

// Toutes les routes sont protégées (auth requise)
router.post("/saved-routes", isAuthenticated, createSavedRoute);
router.get("/saved-routes", isAuthenticated, listSavedRoutes);
router.patch("/saved-routes/:id", isAuthenticated, updateSavedRoute);
router.delete("/saved-routes/:id", isAuthenticated, deleteSavedRoute);
router.post("/saved-routes/:id/extend", isAuthenticated, extendSavedRoute);

export default router;
