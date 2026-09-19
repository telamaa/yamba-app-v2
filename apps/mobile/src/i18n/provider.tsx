/**
 * provider.tsx — la langue de l'application (lot i18n D36, ordre D44).
 * ====================================================================
 * Le moteur est `use-intl` — le cœur de next-intl : mêmes fichiers ICU, même
 * `useTranslations` que le web. Ordre D44 transposé au mobile : la préférence
 * du COMPTE (`preferredLocale`, apprise au login et à /auth/me) prime sur la
 * langue de l'appareil ; un visiteur sans compte lit la langue du téléphone.
 * À chaque changement effectif, la langue est reposée dans `locale-state`
 * pour que le client API l'envoie en `x-locale`.
 */
import { useLocales } from 'expo-localization';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { IntlProvider } from 'use-intl';

import { resolveLocale, type SupportedLocale } from '@packages/api-contracts/locale';

import { setCurrentLocale } from './locale-state';
import { MESSAGES } from './messages';

type PreferredLocaleSetter = (raw: string | null | undefined) => void;

const PreferredLocaleContext = createContext<PreferredLocaleSetter>(() => {});

/** À appeler quand la session apprend (login, /auth/me) ou perd (logout) la
 *  préférence de langue du compte. `null` = retour à la langue de l'appareil. */
export function usePreferredLocaleSetter(): PreferredLocaleSetter {
  return useContext(PreferredLocaleContext);
}

export function AppIntlProvider({ children }: { children: ReactNode }) {
  const deviceTag = useLocales()[0]?.languageTag;
  const [preferred, setPreferred] = useState<SupportedLocale | null>(null);
  const locale = preferred ?? resolveLocale(deviceTag);

  // Le client API (hors React) doit dire la même langue que l'écran.
  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  const setter = useMemo<PreferredLocaleSetter>(
    () => (raw) => setPreferred(raw == null ? null : resolveLocale(raw)),
    []
  );

  return (
    <PreferredLocaleContext.Provider value={setter}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </IntlProvider>
    </PreferredLocaleContext.Provider>
  );
}
