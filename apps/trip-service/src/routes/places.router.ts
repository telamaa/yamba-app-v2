/**
 * places.router.ts — l'autocomplétion de villes (A211)
 * =====================================================
 * Montée sur `/places` dans trip-service (le service qui porte déjà la
 * recherche) et exposée par le gateway en `/api/places/*`. PUBLIQUE : la
 * recherche l'est, son champ de saisie aussi.
 */
import { Router } from "express";
import isOptionallyAuthenticated from "@packages/middleware/isOptionallyAuthenticated";

import { autocompletePlaces } from "../controllers/places.controller";

const router = Router();

// Authentification OPTIONNELLE (motif de la recherche) : un membre connecté
// reçoit ses propositions dans la langue de son COMPTE (D44), un visiteur
// reçoit la même réponse dans celle de son appareil.
router.get("/autocomplete", isOptionallyAuthenticated, autocompletePlaces);

export default router;
