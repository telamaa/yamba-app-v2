/**
 * messages.ts — les dictionnaires du mobile, par espace de noms.
 * ==============================================================
 * Imports STATIQUES : Metro embarque les deux langues dans le bundle (quelques
 * Ko) — il ne sait pas charger `messages/${locale}/…` à la demande comme le
 * fait next-intl côté serveur. Le contrôle CI (scripts/check-i18n-messages.mjs)
 * lit CE fichier pour associer chaque fichier JSON à son espace de noms :
 * garder une ligne d'import par fichier et une liaison par espace, à
 * l'identique entre `fr` et `en`.
 */
import type { SupportedLocale } from '@packages/api-contracts/locale';

import authEn from '../../messages/en/auth.json';
import bookingEn from '../../messages/en/booking.json';
import favoritesEn from '../../messages/en/favorites.json';
import myShipmentsEn from '../../messages/en/myShipments.json';
import myTripsEn from '../../messages/en/myTrips.json';
import publishEn from '../../messages/en/publish.json';
import searchEn from '../../messages/en/search.json';
import shipmentEn from '../../messages/en/shipment.json';
import tabsEn from '../../messages/en/tabs.json';
import tripDetailEn from '../../messages/en/tripDetail.json';
import welcomeEn from '../../messages/en/welcome.json';
import authFr from '../../messages/fr/auth.json';
import bookingFr from '../../messages/fr/booking.json';
import favoritesFr from '../../messages/fr/favorites.json';
import myShipmentsFr from '../../messages/fr/myShipments.json';
import myTripsFr from '../../messages/fr/myTrips.json';
import publishFr from '../../messages/fr/publish.json';
import searchFr from '../../messages/fr/search.json';
import shipmentFr from '../../messages/fr/shipment.json';
import tabsFr from '../../messages/fr/tabs.json';
import tripDetailFr from '../../messages/fr/tripDetail.json';
import welcomeFr from '../../messages/fr/welcome.json';

export const MESSAGES = {
  fr: {
    auth: authFr,
    booking: bookingFr,
    favorites: favoritesFr,
    myShipments: myShipmentsFr,
    myTrips: myTripsFr,
    publish: publishFr,
    search: searchFr,
    shipment: shipmentFr,
    tabs: tabsFr,
    tripDetail: tripDetailFr,
    welcome: welcomeFr,
  },
  en: {
    auth: authEn,
    booking: bookingEn,
    favorites: favoritesEn,
    myShipments: myShipmentsEn,
    myTrips: myTripsEn,
    publish: publishEn,
    search: searchEn,
    shipment: shipmentEn,
    tabs: tabsEn,
    tripDetail: tripDetailEn,
    welcome: welcomeEn,
  },
} satisfies Record<SupportedLocale, Record<string, unknown>>;
