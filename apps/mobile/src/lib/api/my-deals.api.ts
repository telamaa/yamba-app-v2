/**
 * my-deals.api.ts — les demandes reçues par le Voyageur, et les deux réponses.
 * =============================================================================
 * D113. `GET /me/deals` sert la vue VOYAGEUR complète (`CarrierBookingView`) :
 * instantané de trajet, colis, Expéditeur, GAIN (jamais le total payé, A13),
 * lieux, et `allowedActions` calculées par la machine à états.
 *
 * Le type est DÉCRIT ici plutôt qu'importé : `apps/mobile/tsconfig.json` ne
 * déclare pas `@packages/api-contracts` (A223) — zod n'a rien à faire dans
 * le bundle d'un écran. Les fiches, elles, confrontent cette description au
 * contrat réel.
 *
 * Les deux réponses JETTENT, au contraire des lectures : accepter engage le
 * Voyageur ET déclenche le débit de l'Expéditeur (capture manuelle, D39).
 * Un refus du serveur doit se voir.
 */
import { apiFetch } from './client';

/** Une demande brute, telle que l'API la rend — projetée par `lib/mes-demandes.ts`. */
export type DemandeBrute = Record<string, unknown>;

type MyDealsResponse = { deals?: DemandeBrute[] } | DemandeBrute[];

/**
 * Toutes mes demandes reçues. Rend une liste VIDE en cas d'échec : un écran
 * de liste sait dire « rien à montrer », il ne sait rien faire d'une
 * exception.
 */
export async function mesDemandes(): Promise<DemandeBrute[]> {
  try {
    const reponse = await apiFetch<MyDealsResponse>('/me/deals');
    return Array.isArray(reponse) ? reponse : (reponse.deals ?? []);
  } catch {
    return [];
  }
}

type DealResponse = { viewerRole?: 'SHIPPER' | 'CARRIER'; deal?: DemandeBrute };

/** On a ouvert une demande dont on est l'EXPÉDITEUR, pas le Voyageur. */
export class MauvaisRoleError extends Error {
  constructor() {
    super('Cette réservation se lit côté Expéditeur.');
    this.name = 'MauvaisRoleError';
  }
}

/**
 * Une demande, vue par rôle (403 si l'on n'est ni l'Expéditeur ni le
 * Voyageur). On ne l'enveloppe PAS dans un `try` : l'écran d'une demande
 * qu'on n'arrive pas à lire doit le dire, pas afficher une carte vide.
 *
 * `viewerRole` est servi par le SERVEUR : s'il répond `SHIPPER`, c'est que
 * le compte connecté est l'Expéditeur de cette réservation — la vue
 * Voyageur n'a alors rien à montrer, et on le dit plutôt que de lire des
 * champs absents (même garde que `getShipment`, en miroir).
 */
export async function laDemande(dealId: string): Promise<DemandeBrute> {
  const reponse = await apiFetch<DealResponse>(`/deals/${dealId}`);
  if (reponse.viewerRole === 'SHIPPER') throw new MauvaisRoleError();
  return reponse.deal ?? (reponse as DemandeBrute);
}

/**
 * J'accepte. Le serveur vérifie la capacité restante, la porte D31 et
 * capture le paiement (D39) — tout cela dans sa transaction, jamais ici.
 */
export function accepterLaDemande(dealId: string): Promise<unknown> {
  return apiFetch(`/deals/${dealId}/accept`, { method: 'POST' });
}

/** Je refuse. La capacité est libérée et l'empreinte de paiement levée. */
export function refuserLaDemande(dealId: string): Promise<unknown> {
  return apiFetch(`/deals/${dealId}/decline`, { method: 'POST' });
}
