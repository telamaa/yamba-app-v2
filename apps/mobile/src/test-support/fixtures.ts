/**
 * fixtures.ts — les objets d'essai des fiches du mobile (A223).
 * =============================================================
 * Deux fabriques, et une règle : le DÉFAUT est un cas NORMAL et COMPLET —
 * un envoi en attente de Voyageur, un trajet au kilo qui accepte tout. Chaque
 * fiche ne décrit alors que ce qui lui importe (`aShipment({ status:
 * 'DELIVERED' })`), et ce qu'elle ne dit pas reste plausible.
 *
 * Pourquoi des fabriques et non des constantes partagées : un objet partagé
 * qu'une fiche modifie contamine les suivantes. Ici chaque appel construit un
 * objet neuf, y compris ses sous-objets (le `...patch` est de surface, donc
 * une fiche qui veut un `pricing` partiel le donne en entier — c'est voulu :
 * un instantané de prix à moitié rempli n'existe pas côté serveur).
 *
 * Ces types MIROITENT le DTO servi par `GET /deals/:id` et
 * `GET /trips/:id/public`. Ils ne sont pas le contrat : le contrat est dans
 * le registre Zod, et c'est `report-form.spec.ts` / `rating-form.spec.ts`
 * qui le confrontent aux constantes recopiées.
 */
import type { ShipperShipmentDto } from '@/lib/api/shipment.api';
import type { PublicTrip, TripLocation, TripLocationPoint } from '@/lib/api/trip.api';

/** Le 15 mars 2027 à midi UTC — toute date d'essai se lit par rapport à elle. */
export const NOW_ISO = '2027-03-15T12:00:00.000Z';
export const NOW_MS = Date.parse(NOW_ISO);

export function aShipment(patch: Partial<ShipperShipmentDto> = {}): ShipperShipmentDto {
  return {
    id: '68c0ffee68c0ffee68c0ffee',
    tripId: '68bbbbbb68bbbbbb68bbbbbb',
    carrierId: '68aaaaaa68aaaaaa68aaaaaa',
    status: 'PENDING',
    trip: {
      originCity: 'Paris',
      destinationCity: 'Brazzaville',
      originCountryCode: 'FR',
      destinationCountryCode: 'CG',
      originTimezone: 'Europe/Paris',
      destinationTimezone: 'Africa/Brazzaville',
      departureAt: '2027-03-20T08:30:00.000Z',
      transportMode: 'PLANE',
    },
    pricing: {
      weightKg: 2,
      billableWeightKg: 2.3,
      sizeClass: 'S',
      product: 'PARCEL',
      transportCents: 2300,
      commissionCents: 300,
      premiumCents: 0,
      totalShipperCents: 2600,
      currencyCode: 'EUR',
      protectionTier: 'BASIC',
    },
    parcel: {
      category: 'CLOTHES',
      categoryFamily: 'CLOTHES_TEXTILE',
      description: 'Deux pulls et une paire de chaussures',
      declaredValueCents: 12000,
      photoUrls: [],
    },
    recipient: { firstName: 'Awa', lastName: 'Nkounkou', phoneE164: '+242060000000' },
    pickupPlace: { kind: 'AIRPORT', details: 'Terminal 2E' },
    deliveryPlace: { kind: 'CITY_AREA', details: 'Centre-ville' },
    carrier: {
      id: '68aaaaaa68aaaaaa68aaaaaa',
      firstName: 'Serge',
      lastInitial: 'M',
      avatarUrl: null,
      publicSlug: 'serge-m',
    },
    requestedAt: '2027-03-15T09:00:00.000Z',
    expiresAt: '2027-03-16T09:00:00.000Z',
    deliveryCode: null,
    codeRegenerationsLeft: 2,
    trackingEvents: [],
    allowedActions: ['cancel'],
    ...patch,
  };
}

const PARIS: TripLocation = {
  label: 'Paris, France',
  city: 'Paris',
  country: 'France',
  countryCode: 'FR',
  lat: 48.8566,
  lng: 2.3522,
  timezone: 'Europe/Paris',
};

const BRAZZAVILLE: TripLocation = {
  label: 'Brazzaville, Congo',
  city: 'Brazzaville',
  country: 'Congo',
  countryCode: 'CG',
  lat: -4.2634,
  lng: 15.2429,
  timezone: 'Africa/Brazzaville',
};

const AIRPORT: TripLocationPoint = {
  kind: 'AIRPORT',
  details: 'Terminal 2E',
  flexibility: 'EXACT',
  radiusKm: null,
};

export function aTrip(patch: Partial<PublicTrip> = {}): PublicTrip {
  return {
    id: '68bbbbbb68bbbbbb68bbbbbb',
    transportMode: 'PLANE',
    origin: { ...PARIS },
    destination: { ...BRAZZAVILLE },
    dates: {
      departureAt: '2027-03-20T08:30:00.000Z',
      arrivalAt: '2027-03-20T15:05:00.000Z',
      departureTimeLocal: '09:30',
      arrivalTimeLocal: '17:05',
    },
    flightType: 'DIRECT',
    trainTripType: null,
    carTripFlexibility: null,
    flightLayoverCities: [],
    trainStopCities: [],
    categoryConditions: [],
    pickupLocations: [{ ...AIRPORT }],
    deliveryLocations: [{ ...AIRPORT, kind: 'CITY_AREA', details: 'Centre-ville' }],
    currencyCode: 'EUR',
    notes: null,
    minPriceCents: 1000,
    pricePerKgCents: 1000,
    remainingKg: 20,
    checkedBag23PriceCents: null,
    cabinBag12PriceCents: null,
    familyConditions: null,
    ticketVerified: true,
    tripper: {
      id: '68aaaaaa68aaaaaa68aaaaaa',
      publicSlug: 'serge-m',
      firstName: 'Serge',
      lastInitial: 'M',
      avatarUrl: null,
      memberSince: '2026-01-10T00:00:00.000Z',
      carrier: {
        id: '68aaaaaa68aaaaaa68aaaaaa',
        name: 'Serge M.',
        bio: null,
        isVerified: true,
        isSuperCarrier: false,
        ratingsAvg: 4.8,
        ratingsCount: 12,
        totalTripsPublished: 7,
        totalParcelsCarried: 19,
      },
    },
    ...patch,
  };
}
