"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

/**
 * UiPreferences — provider de compatibilité pendant la migration vers next-intl.
 *
 * Ce provider permet à tes composants NON migrés de continuer à fonctionner
 * pendant que tu migres progressivement.
 *
 * ⚠️ DEPRECATED — À utiliser uniquement pendant la migration.
 * Une fois tous les composants migrés vers useTranslations() de next-intl,
 * tu pourras supprimer ce provider.
 *
 * Ce que ça expose:
 * - `lang` → équivalent à useLocale() (lecture seule)
 * - `t(key)` → utilise useTranslations('common') sous le capot
 *
 * Pour les NOUVEAUX composants, utilise directement:
 *   import { useTranslations, useLocale } from 'next-intl';
 *   const t = useTranslations('namespace');  // 'common', 'home', 'search', etc.
 *   const locale = useLocale();
 */

export type UiLang = "fr" | "en";

type UiPrefs = {
  /** Locale actuelle (depuis next-intl) */
  lang: UiLang;
  /** Fonction de traduction bridge vers le namespace "common" */
  t: (key: string) => string;
};

const UiPreferencesContext = createContext<UiPrefs | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale() as UiLang;

  // Charger le namespace "common" avec un fallback safe
  // Les composants legacy faisaient `t("today")`, `t("login")`, etc.
  // On les mappe sur les nouvelles clés organisées (fields.today, nav.login, etc.)
  const tCommon = useTranslations("common");

  // Mapping des anciennes clés plates vers les nouvelles clés imbriquées
  const legacyKeyMap: Record<string, string> = {
    // Anciennes clés → nouvelles clés dans common.json
    from: "fields.from",
    to: "fields.to",
    date: "fields.date",
    today: "fields.today",
    tomorrow: "fields.tomorrow",
    search: "actions.search",
    login: "header.login",
    share: "header.shareTrip",
    quickActions: "nav.quickActions",
  };

  const value = useMemo<UiPrefs>(
    () => ({
      lang: locale,
      t: (key: string) => {
        const mappedKey = legacyKeyMap[key] ?? key;
        try {
          return tCommon(mappedKey);
        } catch {
          // Si la clé n'existe pas, on retourne la clé elle-même (comportement legacy)
          return key;
        }
      },
    }),
    [locale, tCommon]
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  }
  return ctx;
}
