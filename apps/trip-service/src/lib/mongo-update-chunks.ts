/**
 * mongo-update-chunks.ts — contourner la limite Atlas « Pipeline length
 * greater than 50 not supported » (tiers partagés M0/M2/M5).
 * ======================================================================
 * Prisma + MongoDB traduit un `update` contenant des types composites
 * (listes embarquées : pickupLocations, familyConditions…) en un pipeline
 * d'agrégation avec UNE étape `$set` par champ. Le PUT du wizard envoie
 * ~60 champs → > 50 étapes → erreur P2010 côté Atlas.
 *
 * On découpe donc `data` en paquets de ≤ MAX_FIELDS_PER_UPDATE champs,
 * appliqués séquentiellement. Les champs de TRANSITION (status,
 * publishedAt…) vont TOUJOURS dans le dernier paquet : le trajet ne
 * devient PUBLISHED qu'une fois toutes ses données écrites (pas de
 * fenêtre « publié mais incomplet »).
 */

export const MAX_FIELDS_PER_UPDATE = 40;

/** Champs qui doivent être écrits en dernier (transition d'état). */
export const TRAILING_FIELDS = ["status", "publishedAt", "currentStep", "carrierRatingSnapshot"] as const;

export function chunkUpdateData<T extends Record<string, unknown>>(
  data: T,
  maxFields: number = MAX_FIELDS_PER_UPDATE
): Array<Partial<T>> {
  const trailing = new Set<string>(TRAILING_FIELDS);
  const ordinary = Object.keys(data).filter((k) => !trailing.has(k));
  const last = Object.keys(data).filter((k) => trailing.has(k));

  const chunks: Array<Partial<T>> = [];
  for (let i = 0; i < ordinary.length; i += maxFields) {
    const chunk: Partial<T> = {};
    for (const k of ordinary.slice(i, i + maxFields)) (chunk as Record<string, unknown>)[k] = data[k];
    chunks.push(chunk);
  }
  if (last.length > 0) {
    // On accroche les champs de transition au dernier paquet s'il a la place,
    // sinon ils forment un paquet à part — toujours en dernier.
    const tail = chunks.length > 0 ? chunks[chunks.length - 1] : undefined;
    if (tail && Object.keys(tail).length + last.length <= maxFields) {
      for (const k of last) (tail as Record<string, unknown>)[k] = data[k];
    } else {
      const chunk: Partial<T> = {};
      for (const k of last) (chunk as Record<string, unknown>)[k] = data[k];
      chunks.push(chunk);
    }
  }
  return chunks.length > 0 ? chunks : [{}];
}
