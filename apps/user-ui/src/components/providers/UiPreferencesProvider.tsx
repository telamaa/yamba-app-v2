"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLang = "fr" | "en";

type UiPrefs = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  t: (key: string) => string;
};

const dict: Record<UiLang, Record<string, string>> = {
  fr: {
    from: "Départ",
    to: "Destination",
    date: "Date",
    today: "Aujourd’hui",
    search: "Rechercher",
    login: "Log in",
    quickActions: "Actions rapides",
    share: "Share Your Trip",
  },
  en: {
    from: "From",
    to: "To",
    date: "Date",
    today: "Today",
    search: "Search",
    login: "Log in",
    quickActions: "Quick actions",
    share: "Share Your Trip",
  },
};

const UiPreferencesContext = createContext<UiPrefs | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");

  useEffect(() => {
    const saved = (localStorage.getItem("ui_lang") as UiLang | null) ?? "en";
    setLangState(saved);
  }, []);

  const setLang = (l: UiLang) => {
    setLangState(l);
    localStorage.setItem("ui_lang", l);
  };

  const value = useMemo<UiPrefs>(() => {
    return {
      lang,
      setLang,
      t: (key: string) => dict[lang][key] ?? key,
    };
  }, [lang]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return ctx;
}
