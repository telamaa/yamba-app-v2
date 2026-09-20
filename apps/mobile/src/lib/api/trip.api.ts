/**
 * trip.api.ts — la fiche publique d'un trajet (lot page trajet D36).
 * ==================================================================
 * MÊME endpoint que le web : `GET /trips/:id/public` (gateway → trip-service,
 * authentification OPTIONNELLE — connecté, le Bearer part et personnalise
 * `isFavorite`). Le serveur fait tout (RG-MOB-1) : visibilité (masqué,
 * dépublié, supprimé → 404 indiscernable d'un inexistant, ANO-API-02),
 * COMPTAGE de la vue (une par visiteur et par jour — une visite mobile pèse
 * dans les stats de demande comme une visite web, A205 pour le visiteur
 * anonyme), prix en CENTS (la conversion en euros n'a lieu qu'à l'affichage).
 *
 * Les types miroir le DTO de `getPublicTrip` (trip.controller.ts), champ à
 * champ pour ceux que l'écran consomme — même contrat que
 * `apps/user-ui/src/lib/public-trip.types.ts`.
 */
import { apiFetch } from './client';

export type TransportMode = 'PLANE' | 'TRAIN' | 'CAR';
export type FlightType = 'DIRECT' | 'WITH_LAYOVER';
export type TrainTripType = 'DIRECT' | 'WITH_CONNECTION' | 'WITH_INTERMEDIATE_STOPS';
export type CarTripFlexibility = 'DIRECT' | 'DETOUR_BY_AGREEMENT';

export type ParcelCategory =
  | 'CLOTHES'
  | 'SHOES'
  | 'FASHION_ACCESSORIES'
  | 'OTHER_ACCESSORIES'
  | 'BOOKS'
  | 'DOCUMENTS'
  | 'SMALL_TOYS'
  | 'PHONE'
  | 'COMPUTER'
  | 'OTHER_ELECTRONICS'
  | 'CHECKED_BAG_23KG'
  | 'CABIN_BAG_12KG';

/** Conditions par catégorie (moteur legacy) — prix en cents. */
export type TripCategoryCondition = {
  category: ParcelCategory;
  priceAmountCents: number;
};

/** Les 8 familles du moteur PER_KG (D14) : acceptée / supplément / refusée. */
export type TripFamilyCondition = {
  familyKey: string;
  mode: 'ACCEPT' | 'SURCHARGE' | 'REFUSE';
  surchargePct?: number | null;
};

export type LocationKind = 'AIRPORT' | 'TRAIN_STATION' | 'CITY_AREA';
export type LocationFlexibility = 'EXACT' | 'RADIUS' | 'CITY_WIDE';

/** Un lieu de remise ou de livraison activé par le Voyageur. */
export type TripLocationPoint = {
  kind: LocationKind;
  details: string | null;
  flexibility: LocationFlexibility;
  radiusKm: number | null;
};

export type TripLocation = {
  label: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
};

export type TripDates = {
  departureAt: string | null;
  arrivalAt: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
};

export type PublicCarrier = {
  id: string;
  name: string;
  bio: string | null;
  isVerified: boolean;
  isSuperCarrier: boolean;
  ratingsAvg: number;
  ratingsCount: number;
  totalTripsPublished: number;
  totalParcelsCarried: number;
};

export type PublicTripper = {
  id: string;
  publicSlug: string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  memberSince: string;
  carrier: PublicCarrier | null;
};

export type PublicTrip = {
  id: string;
  transportMode: TransportMode | null;
  origin: TripLocation;
  destination: TripLocation;
  dates: TripDates;

  flightType: FlightType | null;
  trainTripType: TrainTripType | null;
  carTripFlexibility: CarTripFlexibility | null;
  flightLayoverCities: string[];
  trainStopCities: string[];

  categoryConditions: TripCategoryCondition[];
  pickupLocations: TripLocationPoint[];
  deliveryLocations: TripLocationPoint[];

  currencyCode: string;
  notes: string | null;

  minPriceCents: number | null;

  // Moteur PER_KG (D13/D14/D19)
  pricePerKgCents?: number | null;
  remainingKg?: number | null;
  checkedBag23PriceCents?: number | null;
  cabinBag12PriceCents?: number | null;
  familyConditions?: TripFamilyCondition[] | null;

  ticketVerified: boolean;
  tripper: PublicTripper;

  /** D46 — favori du membre connecté (false pour un visiteur). */
  isFavorite?: boolean;
  /** D5 / C-PR6 — vues dédoublonnées, cette vue comprise (absent si Redis indisponible). */
  viewsCount?: number;
};

export async function getPublicTrip(id: string): Promise<PublicTrip> {
  const body = await apiFetch<{ success: boolean; trip: PublicTrip }>(`/trips/${id}/public`);
  return body.trip;
}
