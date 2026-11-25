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

/* ── Le brouillon SERVEUR (D111 quater) ───────────────────────────────── */

/**
 * Enregistre l'état courant du tunnel comme BROUILLON.
 *
 * `POST /trips` avec `publish: false` la première fois (le serveur rend un
 * trajet `DRAFT`), `PUT /trips/:id` ensuite. Ce sont les mêmes appels que le
 * bouton « Brouillon » du site : rien n'a été ajouté au serveur pour ce lot.
 *
 * NE JETTE JAMAIS, et c'est la décision centrale : l'enregistrement est une
 * SAUVEGARDE, pas une étape. Le brouillon local reste la copie de travail
 * pendant tout le tunnel ; la copie serveur le rattrape quand elle peut. Un
 * réseau coupé ne doit pas arrêter quelqu'un qui remplit un formulaire —
 * il perdrait justement ce que la sauvegarde est censée protéger.
 *
 * Rend l'identifiant du brouillon, ou `null` si rien n'a pu être enregistré.
 */
export async function enregistrerLeBrouillon(
  corps: CorpsDeTrajet,
  tripId: string | null
): Promise<string | null> {
  const brouillon = { ...corps, publish: false };
  try {
    if (tripId === null) {
      const reponse = await apiFetch<{ success: boolean; trip: TrajetPublie }>('/trips', {
        method: 'POST',
        body: brouillon,
      });
      return reponse.trip.id;
    }
    await apiFetch(`/trips/${tripId}`, { method: 'PUT', body: brouillon });
    return tripId;
  } catch {
    return null;
  }
}

/**
 * Publie un brouillon DÉJÀ enregistré : une seule requête, qui met à jour ET
 * publie (`PUT` avec `publish: true` — le serveur vérifie sa machine à états).
 *
 * Celle-ci JETTE, au contraire de la sauvegarde : c'est le geste qui engage,
 * et son refus doit être montré.
 */
export async function publierLeBrouillon(
  tripId: string,
  corps: CorpsDeTrajet
): Promise<TrajetPublie> {
  const reponse = await apiFetch<{ success: boolean; trip: TrajetPublie }>(`/trips/${tripId}`, {
    method: 'PUT',
    body: { ...corps, publish: true },
  });
  return reponse.trip;
}

/** Un trajet tel que `GET /trips/my` le rend — les champs qu'on relit. */
export type TrajetServeur = Record<string, unknown> & { id: string; status?: string };

/**
 * Mes brouillons, du plus récent au plus ancien.
 *
 * Rend une liste VIDE en cas d'échec : l'écran de seuil doit pouvoir
 * s'afficher sans réseau. Ne pas proposer de reprise est une gêne ; empêcher
 * de commencer serait une panne.
 */
export async function mesBrouillons(): Promise<TrajetServeur[]> {
  try {
    const reponse = await apiFetch<{ trips?: TrajetServeur[] } | TrajetServeur[]>(
      '/trips/my?status=DRAFT'
    );
    const trajets = Array.isArray(reponse) ? reponse : (reponse.trips ?? []);
    return trajets.filter((trajet) => trajet.status === 'DRAFT');
  } catch {
    return [];
  }
}

/**
 * Jette un brouillon serveur. Best effort : « recommencer » ne doit pas
 * échouer parce que le réseau tousse.
 *
 * `hard=true` — le serveur fait un effacement DOUX réservé aux brouillons
 * (`isDeleted`), pas une annulation de trajet publié.
 */
export async function supprimerLeBrouillon(tripId: string): Promise<void> {
  try {
    await apiFetch(`/trips/${tripId}?hard=true`, { method: 'DELETE' });
  } catch {
    // Un brouillon fantôme vaut mieux qu'un geste qui refuse d'aboutir.
  }
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
