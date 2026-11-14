/**
 * search.api.ts — la recherche publique de trajets (lot recherche D36).
 * =====================================================================
 * MÊME endpoint que le web : `GET /trips/search` (gateway → trip-service),
 * mêmes paramètres, même page `{ trips, nextCursor, totalCount }`. Le serveur
 * fait tout (RG-MOB-1) : filtres durs, tri, textes localisés (`travelDate`
 * arrive déjà dans la langue de l'écran via `x-locale`), prix en EUROS dans
 * ce DTO (divisés par 100 par le mapper serveur), et il COMPTE la demande —
 * `recordSearch` (corridor + sans-résultat) est dans le contrôleur : une
 * recherche mobile pèse dans les stats exactement comme une recherche web.
 * La route est en authentification OPTIONNELLE : connecté, le Bearer part et
 * personnalise la réponse (favoris, langue du compte) ; visiteur, rien.
 */
import { PRICING_EXAMPLE_PARAMS } from '@/lib/pricing-example';
import type { SearchFamily } from '@/lib/search-filters';

import { apiFetch } from './client';

/** Catégories de colis (mêmes clés que le web, `search-results.types.ts`). */
export type SearchParcelCategory =
  | 'clothes'
  | 'shoes'
  | 'fashion-accessories'
  | 'other-accessories'
  | 'books'
  | 'documents'
  | 'small-toys'
  | 'phone'
  | 'computer'
  | 'other-electronics'
  | 'checked-bag-23kg'
  | 'cabin-bag-12kg';

export type TripSearchResult = {
  id: string;
  fromCity: string;
  /** Texte figé dans la locale du créateur — préférer fromCountryCode. */
  fromCountry?: string;
  fromCountryCode?: string;
  toCity: string;
  toCountry?: string;
  toCountryCode?: string;
  /** Déjà localisée par le serveur (« 12 juin 2026 » / « June 12, 2026 »). */
  travelDate: string;
  /** ISO 8601 — le SEUL champ datable côté client (`travelDate` est du texte).
   *  Envoyé par le serveur depuis ANO-WEB-30, pour séparer les favoris encore
   *  en ligne des trajets passés. Optionnel : un trajet sans date reste actif. */
  departureAt?: string;
  departureTime: string;
  /** Absente quand le trajet n'a pas d'heure d'arrivée. */
  arrivalTime?: string;
  nextDay?: boolean;
  durationMinutes?: number;
  /** Nombre d'escales (0 = direct). */
  stopovers?: number;
  transportMode: 'plane' | 'train' | 'car';
  /** Euros — minimum des tarifs par catégorie (moteur legacy). */
  minPrice: number;
  /** Euros — moteur PER_KG (D13) ; null/absent = legacy. */
  pricePerKg?: number | null;
  /** Kilos encore disponibles (CAP-02). */
  remainingKg?: number | null;
  /** D99 3C — poids qui a servi aux deux champs ci-dessous : celui choisi par
   *  l'Expéditeur, ou celui supposé (`estimateKg`). */
  weightKg?: number;
  /** D99 3A — total Expéditeur pour ce poids, en euros. Calculé par le SERVEUR,
   *  le seul à connaître les paramètres de plateforme : la projection locale
   *  (`pricing-example`) n'est qu'un repli. */
  totalForWeight?: number | null;
  currency?: string;
  /** Catégories acceptées par le Voyageur (aperçu en pied de carte). */
  allowedCategories?: SearchParcelCategory[];
  /** Places restantes — alerte rouge quand ≤ 3, absent = capacité illimitée. */
  remainingSlots?: number;
  superTripper?: boolean;
  /** D5 / C-PR6 — vues dédoublonnées ; « Populaire » à partir de 20. */
  viewsCount?: number;
  rating?: number;
  reviewCount?: number;
  /** D46 — favori du membre connecté (absent pour un visiteur). */
  isFavorite?: boolean;
  travelerFirstName?: string;
  /** Toujours JUSTE l'initiale (privacy par défaut, côté serveur). */
  travelerLastName?: string;
  travelerAvatarUrl?: string;
};

export type SearchPage = {
  trips: TripSearchResult[];
  nextCursor: string | null;
  totalCount: number;
};

/** Filtre transport des pastilles (« Tout » = pas de paramètre serveur). */
export type SearchTransportFilter = 'all' | 'plane' | 'train' | 'car';

/**
 * Tris serveur (mêmes clés que le web).
 *
 * D100 1A/1B — `relevance` est le défaut du CONTRAT depuis D80 (flux
 * d'atterrissage localisé), et il manquait ici comme sur le site : les deux
 * fronts n'exposaient que trois tris sur quatre, et tous deux OMETTAIENT le
 * paramètre quand il valait `earliest` « parce que c'est le défaut ». Il ne
 * l'était plus côté serveur. Résultat : « Départ le plus tôt » coché, et la
 * pertinence appliquée.
 */
export type SearchSort = 'relevance' | 'earliest' | 'lowestPrice' | 'bestRated';

// D102 2A — les listes vivent dans un module PUR (`@/lib/search-filters`) :
// ce fichier-ci tire le client HTTP, donc `expo-constants`, et aucune fiche ne
// peut le charger. Ré-exportées pour que les consommateurs n'aient qu'un seul
// endroit où regarder.
export {
  SEARCH_FAMILIES,
  TRUST_FILTERS,
  type SearchFamily,
  type TrustFilter,
} from '@/lib/search-filters';

export type SearchParams = {
  from?: string;
  to?: string;
  /** ISO — bornes de la fenêtre de départ. */
  dateFrom?: string;
  dateTo?: string;
  mode?: SearchTransportFilter;
  sort?: SearchSort;
  /**
   * D101 1A/3A — le poids CHOISI par l'Expéditeur. Ce champ n'existait pas :
   * le client mobile ne pouvait émettre aucun poids, et posait `estimateKg`
   * en dur à 2 kg — une hypothèse que la carte affirmait sans que rien dans
   * l'application ne permette de la voir ni de la changer.
   *
   * Il ne se cumule JAMAIS avec `estimateKg` (D99 3C) : `weightKg` filtre ET
   * enrichit (un trajet sans la capacité sort des résultats), `estimateKg`
   * enrichit sans filtrer. Tant que rien n'est choisi, « Tous les trajets
   * disponibles » ne doit retirer aucun trajet.
   */
  weightKg?: number | null;
  /**
   * D102 1B — les quatre signaux de confiance et les familles de colis. Tous
   * existaient au contrat et étaient déjà exercés par le site ; le client
   * mobile ne savait simplement pas les écrire. L'encodage des familles est
   * celui du site : une liste séparée par des virgules.
   */
  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;
  families?: readonly SearchFamily[];
  cursor?: string | null;
  limit?: number;
};

function baseQuery(params: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  // D102 1B — ils vivent dans `baseQuery` et non dans `searchTrips` parce que
  // les FACETTES doivent compter dans le même périmètre : « combien de
  // trajets en train » n'a de sens que parmi les filtres déjà posés.
  if (params.superTripper) query.set('superTripper', 'true');
  if (params.profileVerified) query.set('profileVerified', 'true');
  if (params.instantBooking) query.set('instantBooking', 'true');
  if (params.verifiedTicket) query.set('verifiedTicket', 'true');
  if (params.families?.length) query.set('families', params.families.join(','));
  return query;
}

export async function searchTrips(params: SearchParams): Promise<SearchPage> {
  const query = baseQuery(params);
  // D99 3C / D101 3A — L'UN ou L'AUTRE, jamais les deux. Le poids choisi
  // filtre et enrichit ; à défaut, le colis de RÉFÉRENCE enrichit seulement,
  // pour que chaque carte annonce un total et non un prix au kilo.
  if (typeof params.weightKg === 'number') {
    query.set('weightKg', String(params.weightKg));
  } else {
    query.set('estimateKg', String(PRICING_EXAMPLE_PARAMS.exampleWeightKg));
  }
  if (params.mode && params.mode !== 'all') query.set('mode', params.mode);
  // D100 1A — le tri part TOUJOURS : un défaut écrit des deux côtés dérive.
  if (params.sort) query.set('sort', params.sort);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<SearchPage>(`/trips/search${qs ? `?${qs}` : ''}`);
}

/** Comptes des pastilles transport — sous-ensemble utile du DTO web. */
/**
 * D102 1A — le serveur renvoie SEPT champs ; ce type n'en déclarait que deux.
 * Cinq compteurs voyageaient à chaque recherche et étaient abandonnés au
 * `JSON.parse`. Rien n'a été ajouté au serveur pour ce lot : le contrat était
 * déjà tenu d'un seul côté.
 */
export type SearchFacets = {
  totalCount: number;
  modeCount: { all: number; plane: number; train: number; car: number };
  superTripperCount: number;
  profileVerifiedCount: number;
  instantBookingCount: number;
  verifiedTicketCount: number;
  familyCounts: Record<SearchFamily, number>;
};

export type SearchFacetsParams = Pick<
  SearchParams,
  | 'from'
  | 'to'
  | 'dateFrom'
  | 'dateTo'
  | 'superTripper'
  | 'profileVerified'
  | 'instantBooking'
  | 'verifiedTicket'
  | 'families'
>;

/**
 * GET /trips/search/facets — mêmes paramètres STRUCTURANTS que la recherche,
 * SANS le mode : les pastilles comptent « combien par transport » parmi les
 * filtres actifs (miroir de useSearchFacets côté web).
 */
export async function getSearchFacets(params: SearchFacetsParams): Promise<SearchFacets> {
  const qs = baseQuery(params).toString();
  return apiFetch<SearchFacets>(`/trips/search/facets${qs ? `?${qs}` : ''}`);
}
