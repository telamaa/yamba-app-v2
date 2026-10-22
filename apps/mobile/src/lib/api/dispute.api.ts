/**
 * dispute.api.ts — déposer un signalement sur un envoi livré.
 * ===========================================================
 * MÊME endpoint que le site : `POST /deals/:id/dispute` (deal-service). Le
 * geste est IRRÉVERSIBLE (INV-4) et il a un effet immédiat sur de l'argent :
 * le versement au Voyageur est GELÉ tant que la médiation n'a pas tranché.
 *
 * Trois choses que le serveur décide, et l'app jamais :
 *   • le DROIT de signaler — `dispute` ∈ `allowedActions` (DELIVERED avant
 *     J+4, ou PICKED_UP 48 h après le départ pour un « jamais livré ») ;
 *   • le MOTIF recevable — en transit, seul `NOT_DELIVERED` passe (D51), le
 *     reste est refusé par `DISPUTE_CATEGORY_NOT_ALLOWED` ;
 *   • le NUMÉRO de ticket (`YAM-XXXX`), fabriqué à l'ouverture du dossier.
 *
 * Les photos sont DÉJÀ en ligne quand on arrive ici : elles montent chez
 * ImageKit à la sélection (`uploadDisputePhoto`), et seules leurs URL
 * voyagent dans ce corps — le binaire ne traverse jamais le gateway (D42).
 */
import type { DisputeCategory, DisputeDesiredOutcome } from '@/lib/report-form';

import { apiFetch } from './client';

export type SubmitDisputeInput = {
  category: DisputeCategory;
  /** Déjà trimée et longue d'au moins 50 caractères (le serveur re-vérifie). */
  description: string;
  photoUrls: string[];
  desiredOutcome?: DisputeDesiredOutcome;
};

export type SubmitDisputeResult = {
  bookingId: string;
  ticketNumber: string;
  disputedAt: string;
};

export function submitDispute(
  dealId: string,
  input: SubmitDisputeInput
): Promise<SubmitDisputeResult> {
  return apiFetch<SubmitDisputeResult>(`/deals/${dealId}/dispute`, {
    method: 'POST',
    body: {
      category: input.category,
      description: input.description,
      photoUrls: input.photoUrls,
      ...(input.desiredOutcome ? { desiredOutcome: input.desiredOutcome } : {}),
      // L'engagement d'honneur est un `z.literal(true)` au contrat : il n'a
      // pas de valeur « non ». L'écran n'envoie rien tant que la case n'est
      // pas cochée — ce `true` n'est donc pas un raccourci, c'est la seule
      // valeur que ce champ puisse prendre (anti-abus, spec §3.6).
      pledgeAccepted: true,
    },
  });
}
