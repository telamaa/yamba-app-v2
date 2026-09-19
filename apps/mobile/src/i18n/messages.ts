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
import authFr from '../../messages/fr/auth.json';
import homeFr from '../../messages/fr/home.json';

export const MESSAGES = {
  fr: {
    auth: authFr,
    home: homeFr,
  },
  en: {
    auth: authEn,
    home: homeEn,
  },
} satisfies Record<SupportedLocale, Record<string, unknown>>;
