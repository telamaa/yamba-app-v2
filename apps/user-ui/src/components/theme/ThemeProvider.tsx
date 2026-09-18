"use client";

/**
 * ThemeProvider — le provider de thème MAISON, sans aucun <script> dans l'arbre client
 * =====================================================================================
 * Voir `theme.ts` pour le pourquoi du remplacement de next-themes. Ce fichier reprend la surface
 * que le produit utilisait réellement : `theme`, `setTheme`, `resolvedTheme` (+ `systemTheme` et
 * `themes` par complétude), avec la même convention qu'avant :
 *
 *   - `theme` vaut `undefined` au rendu serveur ET au premier rendu client — identiques, donc
 *     AUCUN écart d'hydratation. Les consommateurs gardent leur garde `mounted`
 *     (HeaderThemeToggle, SettingsSection) : elle reste la bonne façon d'attendre le montage.
 *   - le PREMIER affichage est déjà juste : c'est le script anti-flash du layout racine qui a posé
 *     la classe pendant le parse du HTML — le provider ne fait que reprendre la main ensuite.
 *   - un changement coupe les transitions CSS le temps d'appliquer la classe (l'équivalent du
 *     `disableTransitionOnChange` d'avant) : sans ça, chaque surface colorée fond vers sa
 *     nouvelle couleur en ordre dispersé.
 *   - un autre onglet qui change le thème est suivi (événement `storage`), comme avant.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES, estUnTheme, type Theme, type ThemeResolu } from "./theme";

type ContexteTheme = {
  theme: Theme | undefined;
  resolvedTheme: ThemeResolu | undefined;
  systemTheme: ThemeResolu | undefined;
  themes: readonly Theme[];
  setTheme: (t: Theme) => void;
};

/** Hors provider (ne devrait pas arriver) : un contexte inerte plutôt qu'un crash — comme next-themes. */
const CONTEXTE_INERTE: ContexteTheme = {
  theme: undefined,
  resolvedTheme: undefined,
  systemTheme: undefined,
  themes: THEMES,
  setTheme: () => undefined,
};

const Contexte = createContext<ContexteTheme | null>(null);

export function useTheme(): ContexteTheme {
  return useContext(Contexte) ?? CONTEXTE_INERTE;
}

function lireStocke(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (estUnTheme(v)) return v;
  } catch {
    /* navigation privée, stockage bloqué : le défaut suffit */
  }
  return DEFAULT_THEME;
}

const REQUETE_SOMBRE = "(prefers-color-scheme: dark)";

/** Applique la classe et `color-scheme`, transitions coupées le temps du geste. */
function appliquer(resolu: ThemeResolu) {
  const racine = document.documentElement;
  const style = document.createElement("style");
  style.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}"));
  document.head.appendChild(style);

  racine.classList.remove("light", "dark");
  racine.classList.add(resolu);
  racine.style.colorScheme = resolu;

  // Forcer le calcul de style AVANT de réactiver les transitions, sinon le navigateur
  // regroupe tout et la coupure n'aura servi à rien.
  window.getComputedStyle(racine).transition;
  setTimeout(() => style.remove(), 1);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // `undefined` jusqu'au montage — la valeur est la même au serveur et au premier rendu client.
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);
  const [systemTheme, setSystemTheme] = useState<ThemeResolu | undefined>(undefined);

  // Montage : reprendre l'état que le script anti-flash a déjà appliqué.
  useEffect(() => {
    setThemeState(lireStocke());
    setSystemTheme(matchMedia(REQUETE_SOMBRE).matches ? "dark" : "light");
  }, []);

  // Le système change (réglage OS, heure dorée) : suivre tant que le choix est « system ».
  useEffect(() => {
    const media = matchMedia(REQUETE_SOMBRE);
    const surChangement = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", surChangement);
    return () => media.removeEventListener("change", surChangement);
  }, []);

  // Un AUTRE onglet a changé le thème : se réaligner.
  useEffect(() => {
    const surStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) setThemeState(lireStocke());
    };
    window.addEventListener("storage", surStorage);
    return () => window.removeEventListener("storage", surStorage);
  }, []);

  const resolvedTheme: ThemeResolu | undefined =
    theme === undefined ? undefined : theme === "system" ? systemTheme : theme;

  // Toute évolution du résolu s'applique au document. La première passe (au montage) repose la
  // classe que le script anti-flash avait déjà mise : idempotent, et c'est ce qui garantit que
  // l'état React et le DOM ne divergent jamais.
  useEffect(() => {
    if (resolvedTheme) appliquer(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* le choix vivra le temps de l'onglet */
    }
  }, []);

  const valeur = useMemo<ContexteTheme>(
    () => ({ theme, resolvedTheme, systemTheme, themes: THEMES, setTheme }),
    [theme, resolvedTheme, systemTheme, setTheme]
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
