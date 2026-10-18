/**
 * location-format.ts — la mise en forme d'un lieu de rendez-vous.
 * ===============================================================
 * Deux écrans en ont besoin : la fiche trajet (qui les LISTE) et l'étape des
 * lieux du tunnel (qui en fait CHOISIR un). Mutualisé dès le deuxième appelant
 * plutôt qu'au troisième — une icône recopiée est une icône qui divergera.
 *
 * Les libellés, eux, restent dans les dictionnaires (`tripDetail.locations.*`) :
 * ce module ne traduit rien, il donne la forme et la règle.
 */
import type { Ionicons } from '@expo/vector-icons';

export const LOCATION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  AIRPORT: 'airplane-outline',
  TRAIN_STATION: 'train-outline',
  CITY_AREA: 'business-outline',
};

export const DEFAULT_LOCATION_ICON: keyof typeof Ionicons.glyphMap = 'location-outline';

/**
 * La clé i18n de la souplesse d'un lieu, et ses valeurs. `RADIUS` sans rayon
 * déclaré ne dit rien d'utile : on rend `null` plutôt qu'un « Rayon null km ».
 */
export function flexibilityLabelKey(
  flexibility: string,
  radiusKm: number | null
): { key: string; values?: Record<string, number> } | null {
  if (flexibility === 'RADIUS') {
    return radiusKm ? { key: 'locations.flex.RADIUS', values: { km: radiusKm } } : null;
  }
  return { key: `locations.flex.${flexibility}` };
}
