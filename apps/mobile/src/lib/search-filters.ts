/**
 * search-filters.ts — les filtres de recherche, tels que le CONTRAT les nomme.
 * ============================================================================
 * D102 2A — zéro import, et c'est la raison d'être du fichier. Ces listes
 * vivaient d'abord dans `lib/api/search.api.ts`, qui tire le client HTTP,
 * lequel remonte jusqu'à `expo-constants` : une fiche ne pouvait pas les lire
 * (le harnais est `testEnvironment: node`, sans transformation Expo — frontière
 * assumée d'A223 : une règle qu'on veut tester SORT de l'écran).
 *
 * Les familles sont la TROISIÈME copie de la même liste (contrat
 * `PARCEL_FAMILIES`, site `SEARCH_FAMILIES`, ici). Les deux premières
 * existaient déjà sans que rien ne les compare : une famille ajoutée au
 * serveur et oubliée sur un front disparaîtrait de ses filtres, sans erreur et
 * sans log. Une fiche confronte désormais les trois, le contrat lu au
 * `readFileSync` et jamais importé (D93).
 */

export const SEARCH_FAMILIES = [
  'DOCUMENTS_PAPERS',
  'CLOTHES_TEXTILE',
  'FOOD_DRY_SEALED',
  'ELECTRONICS_DEVICES',
  'COSMETICS_CARE',
  'PARTS_TOOLS',
  'TOYS_CHILDCARE',
  'MISC_ACCESSORIES',
] as const;
export type SearchFamily = (typeof SEARCH_FAMILIES)[number];

/** Les quatre signaux de confiance, dans l'ordre du panneau du site. */
export const TRUST_FILTERS = [
  'superTripper',
  'profileVerified',
  'instantBooking',
  'verifiedTicket',
] as const;
export type TrustFilter = (typeof TRUST_FILTERS)[number];
