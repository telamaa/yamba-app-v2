/**
 * publish.api.ts — publier un trajet (POST /trips).
 * ==================================================
 * MÊME endpoint que le site : gateway → trip-service, `isAuthenticated` +
 * `requireActiveAccount` (un compte restreint ne publie pas, C-PR3/D56).
 *
 * Le serveur reste seul juge (RG-MOB-1) : le tunnel réclame tout AVANT pour
 * qu'un refus n'arrive pas au septième écran, mais c'est lui qui tranche —
 * caps de confiance (CNF-06 `NEW_ACCOUNT_CAP`), compte suspendu, date passée.
 * Son refus porte un `details.code` qu'on expose tel quel (`ApiError.code`,
 * A146) : l'écran le traduit, il ne le réécrit pas.
 */
import type { CorpsDeTrajet } from '@/lib/publish-payload';

import { apiFetch } from './client';

export type TrajetPublie = {
  id: string;
  status: string;
};

export async function publierLeTrajet(corps: CorpsDeTrajet): Promise<TrajetPublie> {
  const reponse = await apiFetch<{ success: boolean; trip: TrajetPublie }>('/trips', {
    method: 'POST',
    body: corps,
  });
  return reponse.trip;
}
