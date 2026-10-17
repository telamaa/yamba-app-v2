/**
 * pricing.api.ts — les paramètres de prix servis par la plateforme (D62 7A).
 * ==========================================================================
 * `GET /trips/pricing/params` — public, mis en cache 30 s côté serveur. MÊME
 * endpoint que le site (`usePricingParams`) : les deux fronts calculent avec
 * les valeurs COURANTES, pas avec une copie figée dans le binaire.
 *
 * Repli assumé : tant que la réponse n'est pas là (ou si elle échoue), on
 * calcule avec les défauts du moteur — identiques aux valeurs du serveur tant
 * qu'aucun administrateur n'a rien changé. Un devis affiché avec des
 * paramètres périmés est de toute façon rattrapé au paiement : le serveur
 * refuse (`QUOTE_DIVERGENCE`) et rien n'est débité.
 *
 * Pas de react-query dans l'app : un cache de module suffit pour une valeur
 * qui bouge quelques fois par an, et la promesse en vol est partagée (deux
 * écrans qui demandent en même temps ne font qu'un appel).
 */
import { PRICING_PARAMS, type PricingParams } from '@packages/pricing';

import { apiFetch } from './client';

type PricingParamsPayload = PricingParams & { version: number };

let cached: PricingParams | null = null;
let inFlight: Promise<PricingParams> | null = null;

/** Les paramètres connus à cet instant — jamais une attente, jamais un throw. */
export function currentPricingParams(): PricingParams {
  return cached ?? PRICING_PARAMS;
}

export async function loadPricingParams(): Promise<PricingParams> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = apiFetch<PricingParamsPayload>('/trips/pricing/params')
    .then((payload) => {
      // On ne garde que les champs du moteur : un champ en plus (version) n'a
      // rien à faire dans un calcul.
      const { version: _version, ...params } = payload;
      cached = params;
      return cached;
    })
    .catch(() => PRICING_PARAMS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
