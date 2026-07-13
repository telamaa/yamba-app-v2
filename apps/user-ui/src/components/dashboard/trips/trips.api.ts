import { mockCarrierTrips } from "./trips.state";
import type { CarrierTripItem } from "./trips.types";

/**
 * Couche API mock du module Mes trajets.
 * Contrat backend cible : GET /me/trips?include=deals (vue Voyageur).
 * La bande "À traiter" est dérivée côté client (deriveCarrierActions).
 */

const MOCK_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMyTrips(): Promise<CarrierTripItem[]> {
  await sleep(MOCK_DELAY_MS);
  console.info("[myTrips] getMyTrips mock:", mockCarrierTrips.length, "trips");
  return [...mockCarrierTrips];
}
