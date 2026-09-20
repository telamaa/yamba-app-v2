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
import homeEn from '../../messages/en/home.json';
import searchEn from '../../messages/en/search.json';
import tabsEn from '../../messages/en/tabs.json';
import tripDetailEn from '../../messages/en/tripDetail.json';
import welcomeEn from '../../messages/en/welcome.json';
import authFr from '../../messages/fr/auth.json';
import homeFr from '../../messages/fr/home.json';
import searchFr from '../../messages/fr/search.json';
import tabsFr from '../../messages/fr/tabs.json';
import tripDetailFr from '../../messages/fr/tripDetail.json';
import welcomeFr from '../../messages/fr/welcome.json';

export const MESSAGES = {
  fr: {
    auth: authFr,
    home: homeFr,
    search: searchFr,
    tabs: tabsFr,
    tripDetail: tripDetailFr,
    welcome: welcomeFr,
  },
  en: {
    auth: authEn,
    home: homeEn,
    search: searchEn,
    tabs: tabsEn,
    tripDetail: tripDetailEn,
    welcome: welcomeEn,
  },
} satisfies Record<SupportedLocale, Record<string, unknown>>;
