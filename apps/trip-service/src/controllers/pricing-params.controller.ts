/**
 * pricing-params.controller.ts — GET /trips/pricing/params (C-PR8a, D62 7A)
 * ========================================================================
 * Public : le wizard de réservation calcule le devis avec le moteur unique
 * (@packages/pricing, D34) et CES valeurs. Le serveur refait le même calcul à la
 * création (deal-service) ; si un admin change un paramètre entre les deux, le
 * total attendu ne correspond plus et le front relit (400 quote mismatch).
 */
import type { Request, Response, NextFunction } from "express";
import { pricingParamsFromSettings, type PricingParamsResponse } from "@packages/api-contracts";
import { platformSettings } from "@packages/libs/settings/default";

export const getPricingParams = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await platformSettings().snapshot();
    const body: PricingParamsResponse = { ...pricingParamsFromSettings(snapshot.values), version: snapshot.version };
    // Recette 02-ADMIN § 5.20 (ADM-PAR-2) — la promesse est « effet en moins de 30 s ». Le lecteur de paramètres a déjà un
    // cache de 30 s ; un `max-age=30` navigateur s'y AJOUTAIT (jusqu'à 60 s dans le wizard). `no-cache` : le navigateur
    // revalide (ETag → 304 sans corps), le seul cache est celui du serveur.
    res.setHeader("Cache-Control", "public, no-cache");
    return res.status(200).json(body);
  } catch (error) {
    return next(error);
  }
};
