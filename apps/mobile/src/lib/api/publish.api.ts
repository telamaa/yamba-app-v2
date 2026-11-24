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

/**
 * Attache le billet au trajet qui vient d'être publié.
 *
 * SÉPARÉ de la création, et c'est imposé par le serveur : le document a
 * besoin de l'id du trajet (`POST /trips/:id/documents`). Conséquence
 * assumée — un échec ici laisse un trajet EN LIGNE sans son billet, donc
 * sans badge. C'est le bon sens de l'échec : mieux vaut un trajet publié
 * sans badge qu'un trajet perdu parce qu'une image n'est pas passée.
 *
 * Le type `TICKET_PROOF` est celui du site (`TripDocumentsManager`).
 */
export async function attacherLeBillet(
  tripId: string,
  document: { url: string; fileId: string; name: string; mimeType: string; sizeBytes: number | null }
): Promise<boolean> {
  try {
    await apiFetch(`/trips/${tripId}/documents`, {
      method: 'POST',
      body: {
        documents: [
          {
            type: 'TICKET_PROOF',
            fileId: document.fileId,
            url: document.url,
            originalName: document.name,
            mimeType: document.mimeType,
            ...(document.sizeBytes === null ? {} : { sizeBytes: document.sizeBytes }),
          },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}
